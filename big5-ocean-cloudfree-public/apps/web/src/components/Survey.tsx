import { BIG5_ITEMS } from "@/lib/big5_items";

{/* instead of rendering Q1, Q2... */}
{BIG5_ITEMS.map((item, idx) => (
  <div key={item.id} className="flex items-center gap-4 py-2">
    <div className="w-full">
      <div className="text-sm text-gray-700 mb-1">
        {item.id}. {item.text} {item.reverse && <span className="italic text-gray-500">(reverse)</span>}
      </div>
      <input
        type="range"
        min={1}
        max={5}
        value={responses[idx] ?? 3}
        onChange={(e) => updateResponse(idx, Number(e.currentTarget.value))}
        className="w-full"
      />
    </div>
    <span className="w-6 text-center text-gray-600">{responses[idx] ?? 3}</span>
  </div>
))}
