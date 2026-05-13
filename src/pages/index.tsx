import { onAuthStateChanged } from 'firebase/auth'
import { ArrowRight, Compass, Globe2, MapPin, Sparkles } from 'lucide-react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

import { getFirebaseAuth, getFirebaseConfigError } from '@/frontend/services/firebase'

const highlights = [
  {
    icon: Globe2,
    title: 'Pin every place',
    description: 'Turn locations into vivid memories with stories, routes, and photos.',
  },
  {
    icon: Sparkles,
    title: 'Relive the journey',
    description: 'Revisit your favorite trips through a beautiful map-first timeline.',
  },
  {
    icon: MapPin,
    title: 'Build your atlas',
    description: 'Create a personal world map that grows with every adventure.',
  },
]

const memoryPhotos = [
  '/memories/lantern-walk.jpg',
  '/memories/lantern-walk-2.jpg',
  '/memories/lantern-walk-3.jpg',
  '/memories/lantern-walk-4.jpg',
]

const HomePage = () => {
  const router = useRouter()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const configError = getFirebaseConfigError()

  useEffect(() => {
    if (configError) {
      setCheckingAuth(false)
      return undefined
    }

    const auth = getFirebaseAuth()

    return onAuthStateChanged(auth, user => {
      if (user) {
        router.replace('/map')
        return
      }

      setCheckingAuth(false)
    })
  }, [configError, router])

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
            <Compass className="h-7 w-7 text-sky-200" />
          </div>
          <p className="text-lg font-black">Loading Geostory...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <Head>
        <title>Geostory | Map your memories</title>
        <meta
          name="description"
          content="Geostory helps you turn places, photos, and moments into an interactive map of your life."
        />
      </Head>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(14,165,233,0.35),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.32),transparent_28%),linear-gradient(135deg,#020617_0%,#0f172a_45%,#082f49_100%)]" />
      <div className="absolute left-[8%] top-24 h-80 w-80 rounded-full bg-sky-400/20 blur-3xl" />
      <div className="absolute right-[8%] top-32 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl" />
      <div className="absolute bottom-0 left-[35%] h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-10 py-8 xl:px-16 2xl:px-20">
        <nav className="flex items-center">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 shadow-lg ring-1 ring-white/15 backdrop-blur">
              <Compass className="h-6 w-6 text-sky-200" />
            </span>
            <span className="text-2xl font-black tracking-tight">Geostory</span>
          </Link>
        </nav>

        <section className="grid flex-1 items-center gap-16 py-14 lg:grid-cols-[0.95fr_1.05fr] xl:gap-24">
          <div className="max-w-4xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-bold text-sky-100 shadow-lg backdrop-blur">
              <Sparkles className="h-4 w-4" />
              Your life, mapped beautifully
            </div>

            <h1 className="text-6xl font-black leading-[0.95] tracking-tight sm:text-7xl xl:text-8xl 2xl:text-9xl">
              Turn every place into a story worth remembering.
            </h1>

            <p className="mt-8 max-w-3xl text-xl leading-9 text-slate-200 xl:text-2xl xl:leading-10">
              Geostory is a cinematic map for your memories. Save the places you have been, attach
              moments that matter, and watch your personal world come alive.
            </p>

            <div className="mt-11 grid max-w-3xl gap-4 sm:grid-cols-2">
              <Link
                href="/login?mode=create"
                className="group inline-flex items-center justify-center gap-3 rounded-full border border-white/20 bg-white/10 px-8 py-4 text-lg font-black text-white shadow-2xl backdrop-blur transition hover:-translate-y-1 hover:bg-white/15"
              >
                Create account
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
              </Link>

              <Link
                href="/login"
                className="group inline-flex items-center justify-center gap-3 rounded-full border border-white/20 bg-white/10 px-8 py-4 text-lg font-black text-white shadow-2xl backdrop-blur transition hover:-translate-y-1 hover:bg-white/15"
              >
                Login
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
              </Link>

              <Link
                href="/map"
                className="group inline-flex items-center justify-center gap-3 rounded-full border border-sky-200/50 bg-sky-300 px-8 py-4 text-lg font-black text-slate-950 shadow-2xl shadow-sky-950/40 transition hover:-translate-y-1 hover:bg-sky-200 sm:col-span-2"
              >
                Continue without login
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
              </Link>
            </div>
          </div>

          <div className="relative ml-auto w-full max-w-2xl">
            <div className="absolute -inset-10 rounded-[3rem] bg-sky-300/20 blur-3xl" />

            <div className="relative rounded-[2rem] bg-white/10 p-5 shadow-2xl backdrop-blur-xl">
              <div className="rounded-[1.5rem] bg-slate-950/45 p-6">
                <div className="mb-6 flex items-start justify-between gap-6">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.3em] text-sky-200">
                      Memory atlas
                    </p>
                    <h2 className="mt-2 text-4xl font-black leading-tight tracking-tight">
                      Singapore <span className="text-sky-200">→</span>
                      <br />
                      Kyoto
                    </h2>
                  </div>

                  <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white">
                    <span className="h-2 w-2 rounded-full bg-violet-300 shadow-[0_0_16px_rgba(196,181,253,0.9)]" />
                    Live
                  </span>
                </div>

                <div className="overflow-hidden rounded-[1.5rem] bg-slate-950/75 shadow-2xl">
                  <div className="relative h-[260px] overflow-hidden sm:h-[320px] xl:h-[360px]">
                    <img
                      src="/memories/lantern-walk.jpg"
                      alt="Lantern walk after rain"
                      className="h-full w-full object-cover"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-transparent" />

                    <div className="absolute left-5 top-5 rounded-full bg-slate-950/50 px-4 py-2 text-sm font-black text-white shadow-xl backdrop-blur">
                      Hoi An, Vietnam
                    </div>
                  </div>

                  <div className="mx-5 mb-5 mt-5 rounded-[1.4rem] bg-white/8 p-5 shadow-xl backdrop-blur-xl">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <p className="text-sm font-black uppercase tracking-[0.28em] text-sky-200">
                        Latest memory
                      </p>

                      <button
                        type="button"
                        aria-label="Save memory"
                        className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white transition hover:bg-white/15"
                      >
                        ☆
                      </button>
                    </div>

                    <h3 className="text-3xl font-black leading-tight tracking-tight text-white">
                      Lantern walk
                      <br />
                      after rain
                    </h3>

                    <p className="mt-4 max-w-md text-base leading-7 text-slate-300">
                      14 photos, 3 notes, and a route saved to your story map.
                    </p>

                    <div className="mt-5 grid grid-cols-[repeat(4,3.5rem)_4rem] gap-2">
                      {memoryPhotos.map((photo, index) => (
                        <div
                          key={`${photo}-${index}`}
                          className="h-14 w-14 overflow-hidden rounded-2xl bg-slate-800 shadow-lg"
                        >
                          <img src={photo} alt="" className="h-full w-full object-cover" />
                        </div>
                      ))}

                      <div className="flex h-14 w-16 items-center justify-center rounded-2xl bg-white/10 text-base font-black text-white shadow-lg">
                        +10
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-3">
                      <div className="rounded-2xl bg-white/8 px-4 py-3 text-center">
                        <p className="text-lg font-black text-white">14</p>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Photos
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white/8 px-4 py-3 text-center">
                        <p className="text-lg font-black text-white">3</p>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Notes
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white/8 px-4 py-3 text-center">
                        <p className="text-lg font-black text-white">1</p>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Route
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 flex items-center gap-3 pt-2 text-sm font-bold text-slate-400">
                      <span className="h-3 w-3 rounded-full bg-violet-400 shadow-[0_0_18px_rgba(167,139,250,0.95)]" />
                      <span>May 12, 2024</span>
                      <span className="h-1 w-1 rounded-full bg-slate-500" />
                      <span>7:45 PM</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 pb-10 md:grid-cols-3">
          {highlights.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="rounded-3xl border border-white/15 bg-white/10 p-7 shadow-xl backdrop-blur transition hover:-translate-y-1 hover:bg-white/15"
            >
              <Icon className="h-9 w-9 text-sky-200" />
              <h2 className="mt-5 text-2xl font-black">{title}</h2>
              <p className="mt-3 text-base leading-7 text-slate-200">{description}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}

export default HomePage
