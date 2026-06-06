import { useState, useEffect } from "react"
import { Button, Text } from "@renderer/components/dash-ui-kit-enxtended"
import { TypeUseCreateWallet } from "@renderer/hooks/useCreateWallet";
import SeedPhraseWarning from "./SeedPhraseWarning";
import { BaseTexts, FillInYourSeedPhraseTexts } from "@renderer/constants";

type VerifySeedPhraseData = Pick<
  FillInYourSeedPhraseTexts,
  'buttonContinue'
> & {
  seedPhraseWarning: BaseTexts
}

type VerifySeedPhraseProps = Pick<TypeUseCreateWallet, 'verifyPhrase' | 'verifyMissingWords'> & {
  data: VerifySeedPhraseData
}

export default function VerifySeedPhrase({ verifyPhrase, verifyMissingWords, data } : VerifySeedPhraseProps): React.JSX.Element {
  const [answers, setAnswers] = useState<string[]>(() => [...verifyPhrase])
  const [loading, setLoading] = useState(false)

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

  const handleContinue = async () => {
    if (loading) return
    setLoading(true)
    try {
      await verifyMissingWords(answers)
    } finally {
      setLoading(false)
    }
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
                  disabled={loading}
                  className={"bg-transparent text-[.875rem] dash-text-default w-full disabled:opacity-60"}
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
          disabled={loading}
        >
          {loading && (
            <svg
              className={"animate-spin size-4"}
              xmlns={"http://www.w3.org/2000/svg"}
              fill={"none"}
              viewBox={"0 0 24 24"}
              aria-hidden={"true"}
            >
              <circle
                className={"opacity-25"}
                cx={"12"}
                cy={"12"}
                r={"10"}
                stroke={"currentColor"}
                strokeWidth={"4"}
              />
              <path
                className={"opacity-75"}
                fill={"currentColor"}
                d={"M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"}
              />
            </svg>
          )}
          {data.buttonContinue}
        </Button>
      </div>
    </div>
  )
}
