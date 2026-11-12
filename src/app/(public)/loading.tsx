import { Container } from "@/components/ui/container";

export default function PublicLoading() {
  return (
    <div aria-busy="true" aria-label="Loading page" className="animate-pulse">
      <div className="border-b border-line bg-white py-10 sm:py-14">
        <Container>
          <div className="h-4 w-40 rounded bg-line" />
          <div className="mt-5 h-9 max-w-md rounded bg-line" />
          <div className="mt-3 h-5 max-w-xl rounded bg-line/70" />
        </Container>
      </div>
      <Container className="py-10">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="h-36 rounded-lg border border-line bg-white" key={index} />
          ))}
        </div>
      </Container>
    </div>
  );
}
