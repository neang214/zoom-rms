import { QRCodeSVG } from "qrcode.react"
import { Leaf } from "lucide-react"

export function buildTableOrderUrl(table) {
  return `${window.location.origin}/order?t=${table.qr_token}`
}

export default function TableQRCode({ table, size = 160 }) {
  const url = buildTableOrderUrl(table)

  return (
    <div className="flex flex-col items-center gap-3 p-5 bg-white rounded-2xl border border-[#e4e7e2] shadow-2xs">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[#1b4d3e] text-white flex items-center justify-center">
          <Leaf size={14} className="rotate-12" />
        </div>
        <div className="text-left leading-tight">
          <div className="font-display font-bold text-sm tracking-wider text-[#141917]">
            ZOOM
          </div>
          <div className="text-[9px] uppercase tracking-widest text-[#6c7872] font-semibold">
            Garden Café &amp; Wine
          </div>
        </div>
      </div>

      <div className="p-2.5 bg-white rounded-xl border border-[#e4e7e2]">
        <QRCodeSVG value={url} size={size} level="M" fgColor="#141917" bgColor="#ffffff" />
      </div>

      <div className="text-center">
        <div className="font-display font-bold text-lg text-[#141917] leading-tight">
          {table.table_number}
        </div>
        <div className="text-[11px] font-medium text-[#6c7872] mt-0.5">
          Scan to view menu &amp; order
        </div>
      </div>
    </div>
  )
}
