export function BookingNotice({legacy=false}:{legacy?:boolean}) {
 return <p className="my-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">{legacy?'This earlier scheduling-preview booking is unfunded. No credits are reserved or transferred for it; completion is unavailable. Create a new funded request for a credit exchange.':'Requests reserve time and credits. Rejection, cancellation before start, or expiry releases the credits. Transfers require both participants to confirm after the scheduled end. Video calls are not available yet.'}</p>;
}
