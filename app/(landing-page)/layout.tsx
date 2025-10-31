import {Instrument_Serif} from 'next/font/google'
import { Inter } from 'next/font/google'

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument-serif',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export default function Layout(props: { children: React.ReactNode }) {
  return (
    <div className={`flex min-h-screen flex-col bg-background text-foreground ${instrumentSerif.variable} ${inter.variable} font-inter`}>
      <main className="flex-1">{props.children}</main>
    </div>
  );
}
