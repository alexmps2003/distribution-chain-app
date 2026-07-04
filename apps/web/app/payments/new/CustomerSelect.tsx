"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function CustomerSelect({
  customers,
}: {
  customers: { id: string; name: string; code: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCustomerId = searchParams.get("customerId") ?? "";

  return (
    <select
      name="customerId"
      required
      value={selectedCustomerId}
      onChange={(e) => {
        const value = e.target.value;
        const params = new URLSearchParams(searchParams);
        if (value) {
          params.set("customerId", value);
        } else {
          params.delete("customerId");
        }
        router.push(`?${params.toString()}`);
      }}
      className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 outline-none focus:border-[#0f77a8] focus:ring-2 focus:ring-[#0f77a8]/15"
    >
      <option value="">Select a customer</option>
      {customers.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} ({c.code})
        </option>
      ))}
    </select>
  );
}
