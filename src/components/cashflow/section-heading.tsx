export function SectionHeading({ title, id }: { title: string; id?: string }) {
  return (
    <h2 id={id} className="mb-5 text-xl font-medium tracking-tight text-black">
      {title}
    </h2>
  );
}
