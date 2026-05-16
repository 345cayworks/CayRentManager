import {
  uploadPropertyPhotosAction,
  deletePropertyPhotoAction,
  setPrimaryPropertyPhotoAction,
  uploadUnitPhotosAction,
  deleteUnitPhotoAction,
  setPrimaryUnitPhotoAction,
} from '@/server/actions';

export type PhotoManagerPhoto = {
  id: string;
  fileName: string;
  isPrimary: boolean;
  contentType: string;
};

export function PhotoManager({
  kind,
  entityId,
  photos,
}: {
  kind: 'property' | 'unit';
  entityId: string;
  photos: PhotoManagerPhoto[];
}) {
  const uploadAction =
    kind === 'property' ? uploadPropertyPhotosAction : uploadUnitPhotosAction;
  const deleteAction =
    kind === 'property' ? deletePropertyPhotoAction : deleteUnitPhotoAction;
  const setPrimaryAction =
    kind === 'property'
      ? setPrimaryPropertyPhotoAction
      : setPrimaryUnitPhotoAction;
  const idField = kind === 'property' ? 'propertyId' : 'unitId';
  const apiBase = kind === 'property' ? 'properties' : 'units';

  return (
    <section className="rounded-xl bg-white border shadow-sm p-4">
      <h3 className="font-semibold">Photos</h3>

      {photos.length === 0 ? (
        <p className="text-slate-600 mt-4">No photos yet.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="relative overflow-hidden rounded-lg border border-slate-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/${apiBase}/${entityId}/photos/${photo.id}`}
                alt={photo.fileName}
                loading="lazy"
                className="h-32 w-full object-cover"
              />
              {photo.isPrimary && (
                <span className="absolute left-2 top-2 rounded-full bg-brand-navy px-2 py-0.5 text-xs font-medium text-white">
                  Primary
                </span>
              )}
              <div className="flex items-center justify-between gap-2 p-2">
                {!photo.isPrimary && (
                  <form action={setPrimaryAction}>
                    <input type="hidden" name="photoId" value={photo.id} />
                    <button
                      type="submit"
                      className="text-xs font-medium text-brand-navy hover:underline"
                    >
                      Make primary
                    </button>
                  </form>
                )}
                <form action={deleteAction} className="ml-auto">
                  <input type="hidden" name="photoId" value={photo.id} />
                  <button
                    type="submit"
                    className="text-xs font-medium text-rose-600 hover:underline"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        action={uploadAction}
        encType="multipart/form-data"
        className="mt-4 border-t pt-4 space-y-2"
      >
        <input type="hidden" name={idField} value={entityId} />
        <input
          type="file"
          name="photos"
          accept="image/png,image/jpeg,image/webp"
          multiple
          required
          className="block w-full text-sm"
        />
        <p className="text-xs text-slate-500">
          JPG, PNG, or WEBP · up to 8MB each
        </p>
        <button
          type="submit"
          className="rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white"
        >
          Upload photos
        </button>
      </form>
    </section>
  );
}
