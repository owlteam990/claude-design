import { useState } from 'react'
import { mockTeam, mockTeamMessages } from '../mocks/data'

// ─── Inline keyframes for pulse-subtle animation ─────────────────
const pulseSubtleStyle = `
@keyframes pulse-subtle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; transform: scale(0.98); }
}
.animate-pulse-subtle {
  animation: pulse-subtle 2s ease-in-out infinite;
}
`

export function AgentTeams() {
  const [inputValue, setInputValue] = useState('')

  return (
    <>
      <style>{pulseSubtleStyle}</style>

      <div className="flex-1 flex flex-col relative overflow-hidden bg-[#FAF9F5] text-[#1B1C1A] font-['Inter'] selection:bg-[#ffdbd0]">
        {/* Code Content Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-5xl mx-auto w-full">
          <div className="space-y-8">
            {/* ─── Message Thread ─── */}
            <div className="space-y-6">
              {/* USER message */}
              <div className="flex gap-4 group">
                <div className="w-8 h-8 rounded-full bg-[#ffdbd0] flex-shrink-0 flex items-center justify-center text-[#390c00] font-bold text-xs">
                  U
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#87736D] uppercase tracking-widest">
                    User
                  </p>
                  <p className="text-[#1B1C1A] leading-relaxed">
                    {mockTeamMessages.userMessage}
                  </p>
                </div>
              </div>

              {/* CLAUDE COMPANION response */}
              <div className="flex gap-4 group">
                <div className="w-8 h-8 rounded-full bg-[#677b4e] flex-shrink-0 flex items-center justify-center text-[#faffea]">
                  <span
                    className="material-symbols-outlined text-sm"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    smart_toy
                  </span>
                </div>
                <div className="space-y-4 flex-1">
                  <p className="text-xs font-semibold text-[#87736D] uppercase tracking-widest">
                    Claude Companion
                  </p>
                  <div className="bg-[#f4f4f0] p-5 rounded-xl border border-[#dac1ba]/10 shadow-sm">
                    <p className="text-[#1B1C1A] mb-4">
                      {mockTeamMessages.assistantMessage}
                    </p>
                    <div className="bg-[#dbdad6] p-4 rounded-lg font-['JetBrains_Mono'] text-[13px] text-[#54433e] overflow-x-auto">
                      <span className="text-[#ad5f45]">info:</span> spawning child_processes for parallel development
                      <br />
                      <span className="text-[#2d628f]">active:</span> session-dev cluster initiated
                      <br />
                      <span className="text-[#4f6237]">ready:</span> 4 agents assigned
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── TEAM STRIP ─── */}
            <div className="relative py-8">
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-[#dac1ba]/20" />

              <div className="relative bg-[#FAF9F5] p-4 rounded-2xl flex flex-col md:flex-row md:items-center gap-4 border border-[#dac1ba]/15 shadow-sm overflow-hidden">
                {/* Team label */}
                <div className="flex items-center gap-3 pr-4 md:border-r border-[#dac1ba]/30">
                  <div className="p-2 bg-[#ffb59d]/20 rounded-lg">
                    <span className="material-symbols-outlined text-[#8F482F] text-xl">
                      groups
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-['Manrope'] text-[#1B1C1A]">
                      Team: {mockTeam.name}
                    </h3>
                    <p className="text-[11px] font-medium text-[#87736D] uppercase tracking-tighter">
                      {mockTeam.memberCount} members
                    </p>
                  </div>
                </div>

                {/* Agent Chips */}
                <div className="flex flex-wrap gap-2 items-center flex-1">
                  {mockTeam.members.map((member) => {
                    if (member.status === 'completed') {
                      return (
                        <div
                          key={member.id}
                          className="flex items-center gap-2 px-3 py-1.5 bg-[#e3e2df] rounded-full border border-[#677b4e]/20 group hover:border-[#677b4e]/50 transition-all cursor-pointer"
                        >
                          <div className="w-2 h-2 rounded-full bg-[#677b4e] shadow-[0_0_8px_rgba(103,123,78,0.4)]" />
                          <span className="text-xs font-semibold font-['Inter'] text-[#1B1C1A]">
                            {member.role}
                          </span>
                          <span
                            className="material-symbols-outlined text-[14px] text-[#4f6237]"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            check_circle
                          </span>
                        </div>
                      )
                    }

                    if (member.status === 'running') {
                      return (
                        <div
                          key={member.id}
                          className="flex items-center gap-2 px-3 py-1.5 bg-[#e3e2df] rounded-full border border-[#8F482F]/20 animate-pulse-subtle group hover:border-[#8F482F]/50 transition-all cursor-pointer"
                        >
                          <div className="w-2 h-2 rounded-full bg-[#f59e0b] shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
                          <span className="text-xs font-semibold font-['Inter'] text-[#1B1C1A]">
                            {member.role}
                          </span>
                          <span
                            className="material-symbols-outlined text-[14px] text-[#f59e0b]"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            sync
                          </span>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[#f4f4f0] rounded-full border border-[#dac1ba]/20 grayscale group hover:grayscale-0 hover:border-[#2d628f]/50 transition-all cursor-pointer"
                      >
                        <div className="w-2 h-2 rounded-full bg-[#87736D] shadow-[0_0_8px_rgba(135,115,109,0.2)]" />
                        <span className="text-xs font-semibold font-['Inter'] text-[#87736D] group-hover:text-[#1B1C1A]">
                          {member.role}
                        </span>
                        <span className="material-symbols-outlined text-[14px] text-[#87736D]">
                          {member.role === 'Tester' ? 'schedule' : 'pause_circle'}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Expand button */}
                <button className="ml-auto p-2 hover:bg-[#e9e8e4] rounded-full transition-colors text-[#87736D]">
                  <span className="material-symbols-outlined text-sm">expand_more</span>
                </button>
              </div>
            </div>

            {/* ─── Chat Composer ─── */}
            <div className="max-w-3xl mx-auto w-full mt-auto">
              <div className="relative bg-white rounded-xl border border-[#dac1ba]/15 p-1.5 shadow-md flex items-center gap-2 focus-within:border-[#dac1ba]/40 transition-all">
                <div className="p-2 text-[#87736D]">
                  <span className="material-symbols-outlined">attach_file</span>
                </div>
                <input
                  className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-sm font-['Inter'] text-[#1B1C1A] py-2"
                  placeholder="Type a command or ask Claude..."
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
                <button className="bg-[#8F482F] text-white w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[#ad5f45] transition-all active:scale-95">
                  <span
                    className="material-symbols-outlined text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    send
                  </span>
                </button>
              </div>
              <div className="mt-3 flex justify-center gap-4">
                <div className="flex items-center gap-1.5 text-[10px] text-[#87736D] font-semibold uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4f6237]" />
                  Auto-run enabled
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-[#87736D] font-semibold uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2d628f]" />
                  Local LLM
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
