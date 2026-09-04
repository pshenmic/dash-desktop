import { useState, useEffect } from "react"
import { Button, Text } from "@renderer/components/dash-ui-kit-enxtended"
import type { UseCreateWalletState } from '@renderer/types/auth'
import SeedPhraseWarning from "./SeedPhraseWarning";
import { BaseTexts, FillInYourSeedPhraseTexts } from "@renderer/constants";

type VerifySeedPhraseData = Pick<
  FillInYourSeedPhraseTexts,
  'buttonContinue'
> & {
  seedPhraseWarning: BaseTexts
}

type VerifySeedPhraseProps = Pick<UseCreateWalletState, 'verifyPhrase' | 'verifyMissingWords'> & {
  data: VerifySeedPhraseData
}

export default function VerifySeedPhrase({ verifyPhrase, verifyMissingWords, data } : VerifySeedPhraseProps): React.JSX.Element {
  const [answers, setAnswers] = useState<string[]>(() => [...verifyPhrase])

  useEffect(() => {
    setAnswers([...verifyPhrase])
  }, [verifyPhrase])

  const handleChange = (index: number, value: string) => {
    setAnswers(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const handleContinue = (): void => {
    void verifyMissingWords(answers)
  }

  return (
    <div className={"flex flex-col w-full gap-6"}>
      <div className={"grid grid-cols-6 gap-3.75 w-full"}>
        {answers.map((word, index) => {
          const isBlank = verifyPhrase[index] === ""
          return (
            <div
              key={index}
              className={`
                flex items-center gap-[.625rem]
                px-[.9375rem] py-[.625rem]
                rounded-[.9375rem]
                border
                ${isBlank ? 'border-dash-brand' : 'border-dash-primary-dark-blue/35 dark:border-white/35'}
              `}
            >
              <Text size={14} weight={"medium"} color={"default"} opacity={30} className={"leading-[164%]"}>
                {index + 1}.
              </Text>

              {isBlank ? (
                <input
                  value={word}
                  onChange={e => handleChange(index, e.target.value)}
                  className={"bg-transparent text-[.875rem] dash-text-default w-full"}
                />
              ) : (
                <Text size={14} weight={"medium"} color={"default"} className={"leading-[164%]"}>
                  {verifyPhrase[index]}
                </Text>
              )}
            </div>
          )
        })}
      </div>

      <SeedPhraseWarning {...data.seedPhraseWarning} />

      <div className="flex gap-[.75rem] items-center">
        <Button
          variant={"solid"}
          colorScheme={"lightBlue-mint"}
          size={"sm"}
          className={"flex-1 p-4.5 gap-2"}
          onClick={handleContinue}
        >
          {data.buttonContinue}
        </Button>
      </div>
    </div>
  )
}
