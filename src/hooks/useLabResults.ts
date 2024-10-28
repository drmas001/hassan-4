import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';
import toast from 'react-hot-toast';

type LabResult = Database['public']['Tables']['lab_results']['Row'];

export function useLabResults(patientId: string) {
  const [results, setResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchLabResults() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('lab_results')
          .select('*')
          .eq('patient_id', patientId)
          .order('resulted_at', { ascending: false });

        if (error) throw error;
        if (mounted) {
          setResults(data || []);
        }
      } catch (error) {
        console.error('Error fetching lab results:', error);
        toast.error('Failed to load lab results');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchLabResults();

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`lab_results_${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lab_results',
          filter: `patient_id=eq.${patientId}`
        },
        (payload) => {
          if (!mounted) return;

          if (payload.eventType === 'INSERT') {
            setResults(current => [payload.new as LabResult, ...current]);
            
            if ((payload.new as LabResult).status === 'Critical') {
              toast.error('Critical lab result received!');
            } else {
              toast.success('New lab result received');
            }
          } else if (payload.eventType === 'UPDATE') {
            setResults(current =>
              current.map(result =>
                result.id === payload.new.id ? (payload.new as LabResult) : result
              )
            );
            toast.success('Lab result updated');
          } else if (payload.eventType === 'DELETE') {
            setResults(current =>
              current.filter(result => result.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [patientId]);

  return { results, loading };
}