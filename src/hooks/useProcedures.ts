import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import type { Database } from '../types/supabase';

type Procedure = Database['public']['Tables']['procedures']['Row'] & {
  performer: {
    name: string;
  };
};

export function useProcedures(patientId: string) {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchProcedures() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('procedures')
          .select(`
            *,
            performer:users!procedures_performer_id_fkey(name)
          `)
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (mounted) {
          setProcedures(data || []);
        }
      } catch (error) {
        console.error('Error fetching procedures:', error);
        toast.error('Failed to load procedures');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchProcedures();

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`procedures_${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'procedures',
          filter: `patient_id=eq.${patientId}`
        },
        async (payload) => {
          if (!mounted) return;

          if (payload.eventType === 'INSERT') {
            // Fetch the complete procedure with performer details
            const { data } = await supabase
              .from('procedures')
              .select(`
                *,
                performer:users!procedures_performer_id_fkey(name)
              `)
              .eq('id', payload.new.id)
              .single();

            if (data) {
              setProcedures(current => [data, ...current]);
              toast.success('New procedure recorded');
            }
          } else if (payload.eventType === 'UPDATE') {
            // Fetch updated procedure to get performer details
            const { data } = await supabase
              .from('procedures')
              .select(`
                *,
                performer:users!procedures_performer_id_fkey(name)
              `)
              .eq('id', payload.new.id)
              .single();

            if (data) {
              setProcedures(current =>
                current.map(proc =>
                  proc.id === payload.new.id ? data : proc
                )
              );
            }
          } else if (payload.eventType === 'DELETE') {
            setProcedures(current =>
              current.filter(proc => proc.id !== payload.old.id)
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

  return { procedures, loading };
}