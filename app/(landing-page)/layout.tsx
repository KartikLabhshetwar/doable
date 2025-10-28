import {Instrument_Serif} from 'next/font/google'

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
})

export default function Layout(props: { children: React.ReactNode }) {
  return (
    <div className={`flex min-h-screen flex-col bg-background text-foreground ${instrumentSerif.className}`}>
      <main className="flex-1">{props.children}</main>
    </div>
  );
}
