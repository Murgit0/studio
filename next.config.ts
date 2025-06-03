
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // Recommended for Netlify and similar platforms
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com', // Kept in case of future use
        port: '',
        pathname: '/**',
      },
      { 
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com', 
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'encrypted-tbn0.gstatic.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'newsapi.org', // For NewsAPI images (though often they point to other domains)
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ichef.bbci.co.uk', // For BBC News images
        port: '',
        pathname: '/**',
      }
      // When integrating real image search from other services,
      // or if NewsAPI returns images from other domains,
      // you will need to add their image CDN hostnames here for next/image optimization.
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

    
