import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

export function SignOutButton() {
  const navigate = useNavigate();

  const handleSignOut = () => {
    localStorage.removeItem('user');
    toast.success('Signed out successfully');
    navigate('/login');
  };

  return (
    <button
      onClick={handleSignOut}
      className="flex items-center px-2 py-2 text-sm font-medium text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md w-full"
    >
      <LogOut className="mr-3 h-5 w-5" />
      Sign Out
    </button>
  );
}