import { redirect } from 'next/navigation'

export default function Home() {
  // Redirige la página principal al login
  redirect('/login')
}