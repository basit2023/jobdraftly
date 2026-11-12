import { Container } from "@/components/ui/container";

export function ProsePage({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <section className="py-10 sm:py-14">
      <Container>
        <article className="max-w-3xl text-[15px] leading-7 text-body [&_a]:font-medium [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_h2:first-child]:mt-0 [&_li]:my-1.5 [&_p]:my-4 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </article>
      </Container>
    </section>
  );
}
