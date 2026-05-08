import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "YouTube upload helper · SafeShorts Studio",
};

export default function YoutubeHelperPage() {
  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-6 text-sm leading-relaxed text-[var(--muted)]">
      <div>
        <h1 className="text-2xl font-semibold text-white">YouTube upload helper</h1>
        <p className="mt-2">
          SafeShorts Studio prepares metadata only.{" "}
          <span className="font-medium text-amber-200/90">
            Manual review is recommended before uploading to YouTube.
          </span>
        </p>
      </div>
      <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5 space-y-3">
        <h2 className="text-base font-medium text-white">Checklist before you upload</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Copy title, description, and hashtags from the project Export page.</li>
          <li>Category: Education, Howto &amp; Style, or Science &amp; Technology often fit factual Shorts.</li>
          <li>
            If visuals or voice are highly realistic synthetic media, YouTube may require disclosure in the
            upload flow. Mark altered / synthetic content when prompted.
          </li>
          <li>Do not rely on third-party clips or trending audio you do not have rights to use.</li>
        </ul>
      </section>
      <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5 space-y-2">
        <h2 className="text-base font-medium text-white">Automatic upload (MVP)</h2>
        <p>
          Automatic OAuth upload is intentionally not included in this MVP. A future optional module could
          live behind a clearly separated package and environment flag so local-first use stays the default.
        </p>
      </section>
    </div>
  );
}
