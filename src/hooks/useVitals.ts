import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';
import toast from 'react-hot-toast';

type Vitals = Database['public']['Tables']['vitals']['Row'];

export function useVitals(patientId: string) {
  const [vitals, setVitals] = useState<Vitals[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchVitals() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('vitals')
          .select('*')
          .eq('patient_id', patientId)
          .order('recorded_at', { ascending: false });

        if (error) throw error;
        if (mounted) {
          setVitals(data || []);
        }
      } catch (error) {
        console.error('Error fetching vitals:', error);
        toast.error('Failed to load vitals');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchVitals();
    
    // Subscribe to real-time changes
    const channel = supabase
      .channel(`vitals_${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vitals',
          filter: `patient_id=eq.${patientId}`
        },
        (payload) => {
          if (!mounted) return;

          if (payload.eventType === 'INSERT') {
            setVitals(current => [payload.new as Vitals, ...current]);
            toast.success('New vitals recorded');
          } else if (payload.eventType === 'UPDATE') {
            setVitals(current =>
              current.map(vital =>
                vital.id === payload.new.id ? (payload.new as Vitals) : vital
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setVitals(current =>
              current.filter(vital => vital.id !== payload.old.id)
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

  return { vitals, loading };
}