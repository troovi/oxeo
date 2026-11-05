import { Button } from '@companix/uikit'

/** Реплика разошлась с сервером: причина и перезагрузка — CRM в этом месте перезагружает страницу. */
export const ResyncBanner = ({ reason }: { reason: string }) => {
  return (
    <div className="resync-banner">
      <span>Реплика разошлась с сервером: {reason}. CRM в этом месте перезагружает страницу.</span>
      <Button size="sm" appearance="negative" onClick={() => window.location.reload()}>
        Перезагрузить
      </Button>
    </div>
  )
}
