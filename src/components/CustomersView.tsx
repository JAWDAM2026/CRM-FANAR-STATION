import React, { useState } from "react";
import { Plus, Search, UserPlus } from "lucide-react";
import { createCustomerRecord } from "../lib/crmService";
import {
  Customer,
  CustomerSegment,
  FANAR_BRANCHES,
  formatArabicDate,
  SEGMENT_LABELS,
} from "../types/crm";
import { StationPicker } from "./StationPicker";

interface CustomersViewProps {
  ownerId: string;
  customers: Customer[];
}

export const CustomersView: React.FC<CustomersViewProps> = ({ ownerId, customers }) => {
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<"all" | CustomerSegment>("all");
  const [showAdd, setShowAdd] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+9665");
  const [city, setCity] = useState("وادي الدواسر");
  const [preferredBranch, setPreferredBranch] = useState(FANAR_BRANCHES[0]);
  const [segment, setSegment] = useState<CustomerSegment>("individual");
  const [isSaving, setIsSaving] = useState(false);

  const filtered = customers.filter((c) => {
    if (segmentFilter !== "all" && c.segment !== segmentFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q)
    );
  });

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await createCustomerRecord({
        name,
        phone,
        city,
        preferredBranch,
        segment,
        ownerId,
      });
      setName("");
      setPhone("+9665");
      setShowAdd(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#1B2E66] dark:text-slate-100">
              دليل عملاء شركة فنار الطاقة للوقود
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              تنظيم بيانات الأفراد وشركات النقل والأساطيل وربطها بسجل البلاغات
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B2E66] dark:bg-[#0D74B8] text-white text-xs font-semibold hover:bg-[#12204A] dark:hover:bg-[#0A5D94] whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة عميل جديد</span>
          </button>
        </div>

        {showAdd && (
          <form
            onSubmit={handleAddCustomer}
            className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-1 md:grid-cols-6 gap-3 items-end"
          >
            <div className="md:col-span-2">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                اسم العميل / المنشأة
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                رقم الجوال
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                المدينة
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                الفئة
              </label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value as CustomerSegment)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
              >
                <option value="individual">أفراد</option>
                <option value="fleet">أساطيل نقل</option>
                <option value="corporate">شركات وجهات</option>
              </select>
            </div>
            <div>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-2 px-3 rounded-lg bg-[#961B5E] text-white text-xs font-semibold hover:bg-[#7A144B] disabled:opacity-50 inline-flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isSaving ? "حفظ..." : "حفظ العميل"}</span>
              </button>
            </div>
            <div className="md:col-span-6">
              <StationPicker
                label="المحطة المفضلة (ابحث بالاسم أو الكود ST)"
                value={preferredBranch}
                onChange={setPreferredBranch}
                showPreviewCard={false}
                compact
              />
            </div>
          </form>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(["all", "individual", "fleet", "corporate"] as const).map((seg) => (
              <button
                key={seg}
                type="button"
                onClick={() => setSegmentFilter(seg)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                  segmentFilter === seg
                    ? "bg-white dark:bg-slate-950 text-[#1B2E66] dark:text-slate-100"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {seg === "all" ? "الجميع" : SEGMENT_LABELS[seg]}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الجوال أو المدينة..."
              className="w-full pr-9 pl-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
            لا يوجد عملاء مطابقون.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <th className="py-3 px-4">العميل</th>
                  <th className="py-3 px-4">الجوال / الواتساب</th>
                  <th className="py-3 px-4">المدينة</th>
                  <th className="py-3 px-4">المحطة المفضلة</th>
                  <th className="py-3 px-4">الفئة</th>
                  <th className="py-3 px-4">عدد الشكاوى</th>
                  <th className="py-3 px-4">تاريخ التسجيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60">
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                      {c.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
                      {c.phone}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                      {c.city}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                      {c.preferredBranch}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#0D74B8] dark:text-sky-400 font-medium">
                      {SEGMENT_LABELS[c.segment]}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs font-bold tabular-nums text-[#1B2E66] dark:text-sky-300">
                      {c.totalComplaints}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {formatArabicDate(c.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
