import React from 'react';
import { Sparkles, Bell, MessageCircle } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="w-full h-20 flex items-center justify-between px-6 bg-white fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center gap-2">
        {/* Logo */}
        <div className="w-10 h-10 bg-vyllo-primary rounded-full flex items-center justify-center text-white">
            <Sparkles size={20} strokeWidth={2.5} fill="currentColor" className="text-vyllo-red" />
        </div>
        <span className="font-bold text-xl tracking-tight text-vyllo-primary hidden md:block">Vyllo</span>
      </div>
      
      <div className="hidden md:flex items-center gap-8 font-medium text-vyllo-primary text-base">
        <button className="hover:bg-vyllo-light px-4 py-2 rounded-pill transition-colors">Home</button>
        <button className="bg-vyllo-primary text-white px-4 py-2 rounded-pill">Create</button>
        <button className="hover:bg-vyllo-light px-4 py-2 rounded-pill transition-colors">Explore</button>
      </div>

      <div className="flex items-center gap-3">
        <button className="p-3 hover:bg-vyllo-light rounded-full text-vyllo-secondary transition-colors">
            <Bell size={24} />
        </button>
        <button className="p-3 hover:bg-vyllo-light rounded-full text-vyllo-secondary transition-colors">
            <MessageCircle size={24} />
        </button>
        <div className="w-8 h-8 rounded-full bg-gray-200 border border-white flex items-center justify-center text-xs font-bold text-gray-500 cursor-pointer hover:bg-gray-300">
          U
        </div>
      </div>
    </header>
  );
};