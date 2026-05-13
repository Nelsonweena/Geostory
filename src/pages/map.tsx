import dynamic from 'next/dynamic'
import Head from 'next/head'

const MapContainer = dynamic(() => import('@/src/map/MapContainer'), { ssr: false })

const MapPage = () => (
  <div className="absolute inset-0 overflow-hidden bg-mapBg">
    <Head>
      <title>Map | Geostory</title>
    </Head>
    <MapContainer />
  </div>
)

export default MapPage
