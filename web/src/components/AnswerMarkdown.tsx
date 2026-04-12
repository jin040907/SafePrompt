import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'

const components: Components = {
  a: ({ node: _n, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer" />
  ),
}

type Props = {
  children: string
  className?: string
}

/** 모델 답변의 **굵게**, 목록, 코드 등 마크다운을 안전하게 렌더링 */
export function AnswerMarkdown({ children, className }: Props) {
  return (
    <div className={className}>
      <ReactMarkdown components={components}>{children}</ReactMarkdown>
    </div>
  )
}
