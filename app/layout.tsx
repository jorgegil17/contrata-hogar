import type {Metadata} from 'next';
import {Geist} from 'next/font/google';
import './globals.css';
const geist=Geist({variable:'--font-geist',subsets:['latin']});
export const metadata:Metadata={title:'Contrata Hogar · Gestión del hogar',description:'Pagos, recibos y recordatorios para gestionar una relación laboral en el hogar.',openGraph:{title:'Contrata Hogar',description:'La gestión del hogar, en orden',images:[{url:'/og.png',width:1536,height:1024,alt:'Contrata Hogar — La gestión del hogar, en orden'}]},twitter:{card:'summary_large_image',title:'Contrata Hogar',description:'La gestión del hogar, en orden',images:['/og.png']}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body className={geist.variable}>{children}</body></html>}
