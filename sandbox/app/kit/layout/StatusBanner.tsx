/** Плашка состояния под шапкой — текст версии о связи с сервером. */
export const StatusBanner = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="resync-banner">
      <span>{children}</span>
    </div>
  )
}
