import React, { useMemo, useState } from "react";
import { Building2, ChevronDown, MapPin, Phone, Search } from "lucide-react";
import {
  FANAR_REGIONS,
  FANAR_STATIONS,
  FanarStation,
  findFanarStation,
} from "../types/crm";

interface StationPickerProps {
  value: string;
  onChange: (branchLabel: string) => void;
  label?: string;
  allowUnknown?: boolean;
  stationUnknown?: boolean;
  onStationUnknownChange?: (unknown: boolean) => void;
  showPreviewCard?: boolean;
  compact?: boolean;
}

export const StationPicker: React.FC<StationPickerProps> = ({
  value,
  onChange,
  label = "المحطة التي تم الوقوف بها",
  allowUnknown = false,
  stationUnknown = false,
  onStationUnknownChange,
  showPreviewCard = true,
  compact = false,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [isListOpen, setIsListOpen] = useState(false);

  const selectedStation: FanarStation | undefined = useMemo(
    () => (stationUnknown ? undefined : findFanarStation(value) || FANAR_STATIONS[0]),
    [value, stationUnknown]
  );

  const filteredStations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return FANAR_STATIONS.filter((st) => {
      if (regionFilter !== "all" && st.region !== regionFilter) return false;
      if (!q) return true;
      return (
        st.code.toLowerCase().includes(q) ||
        st.name.toLowerCase().includes(q) ||
        st.city.toLowerCase().includes(q) ||
        st.region.toLowerCase().includes(q) ||
        st.operator.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, regionFilter]);

  function handleSelect(station: FanarStation) {
    if (onStationUnknownChange && stationUnknown) {
      onStationUnknownChange(false);
    }
    onChange(station.label);
    setIsListOpen(false);
    setSearchQuery("");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
        {allowUnknown && onStationUnknownChange && (
          <label className="inline-flex items-center gap-1.5 text-xs text-[#961B5E] dark:text-pink-400 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={stationUnknown}
              onChange={(e) => {
                onStationUnknownChange(e.target.checked);
                if (e.target.checked) setIsListOpen(false);
              }}
              className="rounded border-slate-300 dark:border-slate-600 text-[#961B5E]"
            />
            <span>لا أعرف المحطة بالضبط (مراجعة يدوية)</span>
          </label>
        )}
      </div>

      {/* Interactive Trigger + Searchable Dropdown Panel */}
      <div className="relative">
        <button
          type="button"
          disabled={stationUnknown}
          onClick={() => setIsListOpen((prev) => !prev)}
          className="w-full px-3 py-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg flex items-center justify-between gap-2 text-right hover:border-[#0D74B8] focus:outline-none focus:border-[#0D74B8] disabled:opacity-50"
        >
          <span className="truncate">
            {stationUnknown
              ? "غير محددة — سيتم توجيه البلاغ يدوياً من فريق الخدمة"
              : selectedStation
              ? `${selectedStation.code} · محطة ${selectedStation.name} — ${selectedStation.city} (${selectedStation.region})`
              : value}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
              isListOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isListOpen && !stationUnknown && (
          <div className="mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden z-30">
            <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50 dark:bg-slate-950">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث باسم المحطة أو الكود (مثل ST-002) أو المدينة..."
                  autoFocus
                  className="w-full pr-8 pl-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-lg focus:outline-none focus:border-[#0D74B8]"
                />
              </div>

              {!compact && (
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setRegionFilter("all")}
                    className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-colors ${
                      regionFilter === "all"
                        ? "bg-[#1B2E66] text-white dark:bg-[#0D74B8]"
                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    كل المناطق (19)
                  </button>
                  {FANAR_REGIONS.map((region) => (
                    <button
                      key={region}
                      type="button"
                      onClick={() => setRegionFilter(region)}
                      className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-colors ${
                        regionFilter === region
                          ? "bg-[#961B5E] text-white"
                          : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStations.length === 0 ? (
                <p className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  لا توجد محطة مطابقة للبحث. تأكد من الكود أو اسم المدينة.
                </p>
              ) : (
                filteredStations.map((st) => {
                  const isSelected = selectedStation?.code === st.code;
                  return (
                    <button
                      key={st.code}
                      type="button"
                      onClick={() => handleSelect(st)}
                      className={`w-full px-3.5 py-2.5 text-right flex items-center justify-between gap-3 transition-colors ${
                        isSelected
                          ? "bg-[#0D74B8]/10 dark:bg-sky-950/40"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/70"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#1B2E66] dark:text-slate-100">
                          <span className="font-mono tabular-nums text-[#961B5E] dark:text-pink-400">
                            {st.code}
                          </span>{" "}
                          · محطة {st.name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {st.city} — {st.region} · {st.operator}
                        </p>
                      </div>
                      <div className="text-left shrink-0 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {st.phone}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Live Preview Card for Selected Station */}
      {showPreviewCard && !stationUnknown && selectedStation && (
        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold text-[#1B2E66] dark:text-slate-100 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#961B5E] dark:text-pink-400 shrink-0" />
              <span>
                <span className="font-mono tabular-nums text-[#961B5E] dark:text-pink-400">
                  {selectedStation.code}
                </span>{" "}
                — محطة {selectedStation.name}
              </span>
            </div>
            <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
              {selectedStation.operationType}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Building2 className="w-3 h-3 shrink-0" />
              <span>
                {selectedStation.city} · منطقة {selectedStation.region} · {selectedStation.operator}
              </span>
            </span>
            <span dir="ltr" className="inline-flex items-center gap-1 font-mono tabular-nums text-[#1B2E66] dark:text-sky-300 font-semibold">
              <Phone className="w-3 h-3 shrink-0" />
              <span>{selectedStation.phone}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
