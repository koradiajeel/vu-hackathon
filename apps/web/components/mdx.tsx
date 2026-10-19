import { PromptCopyBlock } from "@/components/docs/prompt-copy-block"
import defaultMdxComponents from "fumadocs-ui/mdx"
import type { MDXComponents } from "mdx/types"

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    PromptCopyBlock,
    ...components,
  } satisfies MDXComponents
}

export const useMDXComponents = getMDXComponents

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>
}
