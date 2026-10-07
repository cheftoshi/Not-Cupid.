/** Decorative, static vector: no fake members, external images, or animation loop. */
export default function ConnectionSketch({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 360 220" fill="none" aria-hidden="true" focusable="false">
    <g stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M35 46q20-30 45-8m-51 5 6 3-1-9M263 157q40 25 65-14m-10 1 10-1-2 10" />
      <circle cx="124" cy="84" r="25" /><path d="M94 81q-5-43 33-35q30 0 24 31M111 90q12 10 23-2M70 197q-2-85 51-85t53 85M79 161l-24 18M165 151l23 17" />
      <circle cx="243" cy="81" r="24" /><path d="M217 68q12-32 33-22q28 3 15 45M234 88q10 9 18-2M192 201q-2-88 49-88t50 88M199 145l-12 24m-2-115 3-17m14 21 10-14m-35 14-8-14" />
    </g>
    <g fill="currentColor"><circle cx="116" cy="78" r="2"/><circle cx="134" cy="78" r="2"/><circle cx="235" cy="75" r="2"/><circle cx="251" cy="75" r="2"/></g>
  </svg>;
}
