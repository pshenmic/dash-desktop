import { DashLogo } from "dash-ui-kit/react";
import { CreditsIcon, ShieldSmallIcon } from "@renderer/components/dash-ui-kit-extended";
import { SourceKind } from "@renderer/enums/SourceKind";
import { DestinationKind } from "@renderer/enums/DestinationKind";
import type { EndpointKindIconProps } from "@renderer/types/EndpointPicker";

export default function EndpointKindIcon({kind}: EndpointKindIconProps): React.JSX.Element {
  if (kind === SourceKind.Core || kind === DestinationKind.CoreAddress) return <DashLogo size={16} containerClassName={"w-fit shrink-0"} />
  if (kind === SourceKind.Shielded) return <ShieldSmallIcon size={16} className={"text-dash-brand dark:text-dash-mint"} />
  return <CreditsIcon size={16} />
}
