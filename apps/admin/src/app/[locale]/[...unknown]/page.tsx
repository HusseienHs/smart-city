import { notFound } from 'next/navigation';

/**
 * Any URL that matches no page renders the localized 404 (`[locale]/not-found.tsx`) inside the
 * locale's root layout, instead of Next.js's built-in, unstyled English page.
 */
export default function UnknownPage(): never {
  notFound();
}
