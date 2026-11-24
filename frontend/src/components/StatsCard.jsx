import React from 'react';

export default function StatsCard({ title, value, subtitle, icon: Icon, color = 'blue', trend }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#262626] bg-[#1A1A1A] p-5 transition-all duration-200 hover:border-[#3A3A3A] hover:bg-[#1F1F1F] shadow-sm group select-none">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-[#9A9A9A] uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-extrabold tracking-tight text-white pt-1 font-mono">{value}</h3>
          {subtitle && <p className="text-xs text-[#9A9A9A] pt-0.5">{subtitle}</p>}
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-[#0D0D0D] border border-[#262626] flex items-center justify-center text-white group-hover:scale-105 transition-transform shrink-0">
            <Icon className="w-5 h-5 text-white stroke-[1.75]" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3.5 pt-3 border-t border-[#262626] flex items-center gap-1.5 text-xs text-[#9A9A9A]">
          <span className="font-semibold text-emerald-400">{trend}</span>
          <span>vs last session</span>
        </div>
      )}
    </div>
  );
}
