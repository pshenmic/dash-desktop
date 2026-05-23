import { Button, Text } from "@renderer/components/dash-ui-kit-enxtended";
import { TypeUseCreateWallet, WordCount } from "@renderer/hooks/useCreateWallet";
import { Switch } from "dash-ui-kit/react";
import SeedPhraseWarning from "./SeedPhraseWarning";
import { BaseTexts, SaveYourSeedPhraseTexts } from "@renderer/constants";

type SeedPhraseData = Pick<
  SaveYourSeedPhraseTexts,
  'buttonContinue' |
  'buttonCopy'
> & {
  seedPhraseWarning: BaseTexts
}

type SeedPhraseProps = Pick<TypeUseCreateWallet, 'seedPhrase' | 'wordCount' | 'setWordCount' | 'verifySeedPhrase'> & {
  data: SeedPhraseData
}

export default function SeedPhrase({ seedPhrase, wordCount, setWordCount, verifySeedPhrase, data } : SeedPhraseProps): React.JSX.Element {
  const options = [
    { label: "12 words", value: 12 as const },
    { label: "24 words", value: 24 as const },
  ]

  const handleChange = (value: WordCount) => {
    setWordCount(value)
  }

  return (
    <div className={"flex flex-col w-full gap-6"}>
      <Switch
        options={options}
        value={wordCount}
        onChange={handleChange}
      />

      <div className={"grid grid-cols-6 gap-3.75 w-full"}>
        {seedPhrase.map(( word, index ) => (
          <div
            key={index}
            className={`
              flex items-center gap-[.625rem]
              px-[.9375rem] py-[.625rem]
              rounded-[.9375rem]
              border border-dash-primary-dark-blue/35 dark:border-white/35
            `}
          >
            <Text size={14} weight={"medium"} color={"default"} opacity={30} className={"leading-[164%]"}>
              {index + 1}.
            </Text>
            <Text size={14} weight={"medium"} color={"default"} className={"leading-[164%]"}>
              {word}
            </Text>
          </div>
        ))}
      </div>

      <SeedPhraseWarning {...data.seedPhraseWarning} />

      <div className={"flex gap-[.75rem] items-center"}>
        <Button variant={"solid"} colorScheme={"primary"} size={"sm"} className={"flex-1 p-4.5"} onClick={() => verifySeedPhrase()}>{data.buttonContinue}</Button>
        <Button
          variant={"solid"}
          colorScheme={"lightBlue-mint"}
          size={"sm"}
          className={"w-[16rem] p-4.5"}
          onClick={() => navigator.clipboard.writeText(seedPhrase.join(' '))}
        >
          {data.buttonCopy}
        </Button>
      </div>
    </div>
  )
}
