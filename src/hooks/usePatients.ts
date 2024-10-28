import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  diagnosis: string;
  bed_number: string;
  status: string;
  admission_date: string;
}

interface UsePatients {
  patients: Patient[];
  loading: boolean;
  error: Error | null;
}

export function usePatients(): UsePatients {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: supabaseError } = await supabase
          .from('patients')
          .select('*')
          .order('admission_date', { ascending: false });

        if (supabaseError) {
          throw new Error(supabaseError.message);
        }

        setPatients(data || []);
      } catch (err) {
        const error = err as Error;
        console.error('Error fetching patients:', error);
        setError(error);
        toast.error('Failed to load patients');
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();

    // Subscribe to real-time changes
    const subscription = supabase
      .channel('patients')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setPatients((current) => [payload.new as Patient, ...current]);
          toast.success('New patient admitted');
        } else if (payload.eventType === 'UPDATE') {
          setPatients((current) =>
            current.map((patient) =>
              patient.id === payload.new.id ? (payload.new as Patient) : patient
            )
          );
          toast.success('Patient information updated');
        } else if (payload.eventType === 'DELETE') {
          setPatients((current) =>
            current.filter((patient) => patient.id !== payload.old.id)
          );
          toast.success('Patient discharged');
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { patients, loading, error };
}