const chapters = ["Your goals", "Your resources", "CPF", "Optional details", "Review"];

export function QuizProgress({ chapter, detail }: { chapter: number; detail: string }) {
  return <nav className="quiz-progress" aria-label="Plan progress">
    <div className="quiz-progress__top"><span>Chapter {chapter + 1} of {chapters.length}</span><strong>{detail}</strong></div>
    <ol className="quiz-chapters">{chapters.map((label, index) => <li key={label} aria-current={index === chapter ? "step" : undefined} className={index < chapter ? "is-complete" : ""}><span>{index + 1}</span>{label}</li>)}</ol>
  </nav>;
}
