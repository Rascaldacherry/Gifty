export function HeroArt({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 440 330" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="box" x1="140" y1="90" x2="310" y2="290" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B2A0D9" />
          <stop offset="1" stopColor="#9180BF" />
        </linearGradient>
        <linearGradient id="lid" x1="147" y1="119" x2="301" y2="175">
          <stop stopColor="#C6B5E5" />
          <stop offset="1" stopColor="#B6A3D8" />
        </linearGradient>
        <linearGradient id="ribbon" x1="203" y1="70" x2="241" y2="251">
          <stop stopColor="#F9F0DB" />
          <stop offset="1" stopColor="#DED0AF" />
        </linearGradient>
        <filter id="shadow" x="0" y="0" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>
      <ellipse cx="252" cy="168" rx="152" ry="140" fill="#E9E1F0" fillOpacity=".65" />
      <ellipse
        cx="253"
        cy="285"
        rx="126"
        ry="14"
        fill="#887897"
        fillOpacity=".13"
        filter="url(#shadow)"
      />
      <g transform="rotate(-10 129 232)">
        <path d="M73 203L142 189L178 208L109 225Z" fill="#F3DDCC" />
        <path d="M73 203L109 225V285L73 263Z" fill="#DBB9A3" />
        <path d="M109 225L178 208V268L109 285Z" fill="#E5C6B0" />
        <path d="M98 200L166 217V278L154 281V221L88 204Z" fill="#FDF4E3" />
        <path
          d="M105 199C80 173 82 164 100 173C112 179 119 194 119 197M118 197C121 169 145 162 144 176C143 189 123 196 118 197"
          stroke="#FDF4E3"
          strokeWidth="10"
          strokeLinecap="round"
        />
      </g>
      <path d="M161 164L254 137L331 177V268L235 301L161 258Z" fill="url(#box)" />
      <path d="M235 205L331 177V268L235 301Z" fill="#8976B2" />
      <path d="M161 164L235 205V301L161 258Z" fill="#A793CA" />
      <path d="M151 139L247 111L342 161L243 194Z" fill="url(#lid)" />
      <path d="M151 139L243 187V209L151 162Z" fill="#B9A5DC" />
      <path d="M243 187L342 155V178L243 209Z" fill="#A38ACB" />
      <path d="M190 126L283 174V287L260 294V181L169 133Z" fill="url(#ribbon)" />
      <path d="M287 132L306 142L206 178V282L187 271V169Z" fill="#F5E9CE" />
      <path
        d="M243 123C198 111 186 77 202 69C220 61 248 92 249 118"
        stroke="#F0E3C9"
        strokeWidth="18"
      />
      <path
        d="M249 121C246 83 278 62 289 76C303 95 273 119 249 121"
        stroke="#F9F0DD"
        strokeWidth="17"
      />
      <path
        d="M246 120C260 138 274 142 281 145"
        stroke="#F7EBD4"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <g transform="rotate(12 340 245)">
        <path d="M305 222L358 208L389 227L337 244Z" fill="#EEE7D6" />
        <path d="M305 222L337 244V293L305 271Z" fill="#D7CFB9" />
        <path d="M337 244L389 227V275L337 293Z" fill="#E3DCC9" />
        <path d="M332 215L364 234V284L352 288V238L320 219Z" fill="#AC9AC7" />
        <path
          d="M339 216C313 198 317 185 328 193C335 198 340 211 340 216M341 216C348 193 366 192 362 202C358 212 346 216 341 216"
          stroke="#AB98C7"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </g>
      <path d="M120 77V95M111 86H129" stroke="#A18BBD" strokeWidth="2" strokeLinecap="round" />
      <path d="M361 87L364 95L372 98L364 101L361 109L358 101L350 98L358 95Z" fill="#C0A5B9" />
      <circle cx="99" cy="146" r="3" fill="#B19EC9" />
      <path
        d="M383 164C384 155 396 156 395 164C395 172 383 178 383 178C383 178 371 171 372 164C372 157 382 156 383 164Z"
        fill="#B59AC9"
      />
    </svg>
  );
}
