import Form from "next/form";
import { ChevronDown, MapPin, Search } from "lucide-react";

import { SearchButton } from "./search-button";

type CityOption = { name: string; slug: string };

export function HeroSearch({ cities }: { cities: CityOption[] }) {
  return (
    <Form
      action="/jobs"
      className="grid gap-2 rounded-lg border border-line bg-white p-2 shadow-sm sm:grid-cols-[1.4fr_1fr_auto] sm:gap-0"
      role="search"
    >
      <label className="relative block">
        <span className="sr-only">Job title, skill or company</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted"
        />
        <input
          className="min-h-12 w-full rounded-md bg-transparent pl-11 pr-4 text-[15px] text-ink outline-none placeholder:text-muted focus-visible:bg-paper"
          name="q"
          placeholder="Job title, skill or company"
          type="search"
        />
      </label>

      <label className="relative block border-line sm:border-l">
        <span className="sr-only">City</span>
        <MapPin
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted"
        />
        <select
          className="min-h-12 w-full appearance-none rounded-md bg-transparent pl-11 pr-9 text-[15px] text-ink outline-none focus-visible:bg-paper"
          defaultValue=""
          name="city"
        >
          <option value="">All of Pakistan</option>
          {cities.map((city) => (
            <option key={city.slug} value={city.slug}>
              {city.name}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        />
      </label>

      <SearchButton label="Search jobs" />
    </Form>
  );
}
