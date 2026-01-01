import { Phone, Mail, Instagram } from 'lucide-react';

export function ContactBar() {
  return (
    <div className="bg-primary-600 dark:bg-primary-700 text-white py-2 px-4">
      <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 text-sm">
        <a
          href="tel:+918888546860"
          className="flex items-center gap-1.5 hover:text-primary-100 transition-colors"
        >
          <Phone className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">+91 8888546860</span>
          <span className="sm:hidden">Call</span>
        </a>
        <a
          href="mailto:sangriacricket@gmail.com"
          className="flex items-center gap-1.5 hover:text-primary-100 transition-colors"
        >
          <Mail className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">sangriacricket@gmail.com</span>
          <span className="sm:hidden">Email</span>
        </a>
        <a
          href="https://instagram.com/sangriacricket_official"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 hover:text-primary-100 transition-colors"
        >
          <Instagram className="w-3.5 h-3.5" />
          <span>@sangriacricket_official</span>
        </a>
      </div>
    </div>
  );
}
