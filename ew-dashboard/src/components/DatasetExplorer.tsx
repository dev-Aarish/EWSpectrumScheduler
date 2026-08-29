"use client";

import { useState, useMemo } from "react";
import { Search, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";

interface TestStat {
  id: number;
  n_pulses: number;
  n_emitters: number;
  n_types: number;
  mean_Frequency: number;
  mean_Amplitude: number;
  std_Frequency: number;
  min_Frequency: number;
  max_Frequency: number;
}

interface DatasetExplorerProps {
  testStats: TestStat[];
  currentConfigId: string;
  onConfigSelect: (configId: string) => void;
}

type SortKey = keyof TestStat;

export default function DatasetExplorer({
  testStats,
  currentConfigId,
  onConfigSelect,
}: DatasetExplorerProps) {
  const [sortKey, setSortKey] = useState<SortKey>("n_pulses");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);

  const filtered = useMemo(() => {
    let data = [...testStats];
    if (search) {
      data = data.filter((d) => d.id.toString().includes(search));
    }
    data.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
    return data;
  }, [testStats, sortKey, sortDir, search]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => (
    <ArrowUpDown
      size={9}
      className={`ml-1 ${sortKey === col ? "text-[#D98E33]" : "text-[#5C636D]"}`}
    />
  );

  return (
    <div className="bg-[#12151A] border border-[#22262D] flex flex-col">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3 py-2 border-b border-[#22262D] flex items-center justify-between hover:bg-[#181C22] transition-colors"
      >
        <span className="section-label">Dataset Explorer</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[#5C636D] tabular-nums">
            {testStats.length} configs
          </span>
          {isExpanded ? (
            <ChevronDown size={12} className="text-[#5C636D]" />
          ) : (
            <ChevronRight size={12} className="text-[#5C636D]" />
          )}
        </div>
      </button>

      {isExpanded && (
        <>
          {/* Search */}
          <div className="px-3 py-2 border-b border-[#22262D]">
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-[#5C636D]"
              />
              <input
                type="text"
                placeholder="Filter by ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0E1013] border border-[#22262D] text-[#E8EAED] text-[11px] font-mono pl-7 pr-2 py-1 rounded focus:outline-none focus:border-[#D98E33]/50 placeholder:text-[#5C636D]"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-auto max-h-48">
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="border-b border-[#22262D]">
                  <th
                    onClick={() => handleSort("id")}
                    className="px-2 py-1.5 text-left text-[#5C636D] font-medium cursor-pointer hover:text-[#9BA3AD] transition-colors"
                  >
                    ID <SortIcon col="id" />
                  </th>
                  <th
                    onClick={() => handleSort("n_pulses")}
                    className="px-2 py-1.5 text-right text-[#5C636D] font-medium cursor-pointer hover:text-[#9BA3AD] transition-colors"
                  >
                    Pulses <SortIcon col="n_pulses" />
                  </th>
                  <th
                    onClick={() => handleSort("n_emitters")}
                    className="px-2 py-1.5 text-right text-[#5C636D] font-medium cursor-pointer hover:text-[#9BA3AD] transition-colors"
                  >
                    Emitters <SortIcon col="n_emitters" />
                  </th>
                  <th
                    onClick={() => handleSort("mean_Frequency")}
                    className="px-2 py-1.5 text-right text-[#5C636D] font-medium cursor-pointer hover:text-[#9BA3AD] transition-colors"
                  >
                    Mean Freq <SortIcon col="mean_Frequency" />
                  </th>
                  <th
                    onClick={() => handleSort("mean_Amplitude")}
                    className="px-2 py-1.5 text-right text-[#5C636D] font-medium cursor-pointer hover:text-[#9BA3AD] transition-colors"
                  >
                    Mean Amp <SortIcon col="mean_Amplitude" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 20).map((row) => {
                  const configId = `config_${row.id}`;
                  const isActive = currentConfigId === configId;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => onConfigSelect(configId)}
                      className={`border-b border-[#22262D] cursor-pointer transition-colors ${
                        isActive
                          ? "bg-[#D98E33]/10 text-[#D98E33]"
                          : "text-[#9BA3AD] hover:bg-[#181C22] hover:text-[#E8EAED]"
                      }`}
                    >
                      <td className="px-2 py-1.5 tabular-nums">{row.id}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {row.n_pulses.toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {row.n_emitters}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {row.mean_Frequency.toFixed(0)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {row.mean_Amplitude.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
