import { Container } from "@/components/ui/container";

export function PageHero({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-b border-line bg-white py-10 sm:py-14">
      <Container>
        <div className="max-w-3xl">
          <h1 className="text-balance text-3xl font-bold text-ink sm:text-4xl">{title}</h1>
          {description ? (
            <p className="mt-3 max-w-2xl text-base leading-7 text-body">{description}</p>
          ) : null}
          {children}
        </div>
      </Container>
    </section>
  );
}
