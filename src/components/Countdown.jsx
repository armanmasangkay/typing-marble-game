export default function Countdown({ value }) {
  return (
    <div className="panel countdown">
      <div className="countdown-number" key={value}>{value}</div>
      <p>Get ready — fill your bucket first!</p>
    </div>
  )
}
