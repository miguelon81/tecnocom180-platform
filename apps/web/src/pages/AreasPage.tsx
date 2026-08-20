import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import {
  createArea,
  deleteArea,
  getAreas,
  updateArea,
} from '../api/areas'

import type {
  CreateAreaInput,
  UpdateAreaInput,
} from '../api/areas'

import { getSites } from '../api/sites'

import type {
  Area,
  Site,
} from '../types/site'

type AreaForm = {
  siteId: string
  name: string
  type: string
}

const emptyForm: AreaForm = {
  siteId: '',
  name: '',
  type: '',
}

function AreasPage() {
  const [areas, setAreas] = useState<Area[]>([])
  const [sites, setSites] = useState<Site[]>([])

  const [selectedSiteId, setSelectedSiteId] =
    useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] =
    useState<string | null>(null)

  const [showForm, setShowForm] =
    useState(false)

  const [editingArea, setEditingArea] =
    useState<Area | null>(null)

  const [form, setForm] =
    useState<AreaForm>(emptyForm)

  async function loadAreas(siteId?: string) {
    try {
      setLoading(true)
      setError(null)

      const data = await getAreas(siteId)

      setAreas(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al cargar las áreas',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function initialize() {
      try {
        setLoading(true)
        setError(null)

        const siteData = await getSites()

        setSites(siteData)

        if (siteData.length === 0) {
          setAreas([])
          return
        }

        const firstSiteId =
          selectedSiteId || siteData[0].id

        setSelectedSiteId(firstSiteId)

        const areaData =
          await getAreas(firstSiteId)

        setAreas(areaData)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Error al cargar las áreas',
        )
      } finally {
        setLoading(false)
      }
    }

    initialize()
  }, [])

  useEffect(() => {
    if (!selectedSiteId) {
      return
    }

    loadAreas(selectedSiteId)
  }, [selectedSiteId])

  function openCreateForm() {
    setEditingArea(null)

    setForm({
      ...emptyForm,
      siteId: selectedSiteId,
    })

    setFormError(null)
    setShowForm(true)
  }

  function openEditForm(area: Area) {
    setEditingArea(area)

    setForm({
      siteId: area.siteId,
      name: area.name,
      type: area.type ?? '',
    })

    setFormError(null)
    setShowForm(true)
  }

  function closeForm() {
    if (saving) {
      return
    }

    setShowForm(false)
    setEditingArea(null)
    setForm(emptyForm)
    setFormError(null)
  }

  function handleChange(
    field: keyof AreaForm,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!form.siteId) {
      setFormError(
        'El sitio es obligatorio',
      )
      return
    }

    if (!form.name.trim()) {
      setFormError(
        'El nombre del área es obligatorio',
      )
      return
    }

    try {
      setSaving(true)
      setFormError(null)

      if (editingArea) {
        const data: UpdateAreaInput = {
          name: form.name.trim(),
          type: form.type.trim(),
        }

        const updatedArea =
          await updateArea(
            editingArea.id,
            data,
          )

        setAreas((current) =>
          current
            .map((area) =>
              area.id === updatedArea.id
                ? updatedArea
                : area,
            )
            .sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
        )
      } else {
        const data: CreateAreaInput = {
          siteId: form.siteId,
          name: form.name.trim(),
          type: form.type.trim(),
        }

        const createdArea =
          await createArea(data)

        setAreas((current) =>
          [...current, createdArea].sort(
            (a, b) =>
              a.name.localeCompare(b.name),
          ),
        )
      }

      closeForm()
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Error al guardar el área',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(area: Area) {
    const confirmed =
      window.confirm(
        `¿Seguro que deseas eliminar el área "${area.name}"?`,
      )

    if (!confirmed) {
      return
    }

    try {
      setError(null)

      await deleteArea(area.id)

      setAreas((current) =>
        current.filter(
          (item) =>
            item.id !== area.id,
        ),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al eliminar el área',
      )
    }
  }

  const selectedSite = sites.find(
    (site) =>
      site.id === selectedSiteId,
  )

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            TECNOCOM180 PLATFORM
          </p>

          <h1>Áreas</h1>

          <p className="subtitle">
            Gestión de áreas e infraestructura
            dentro de cada sitio.
          </p>
        </div>

        <div className="site-count">
          {areas.length}{' '}
          {areas.length === 1
            ? 'área'
            : 'áreas'}
        </div>
      </header>

      {error && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '8px',
            border:
              '1px solid #dc2626',
          }}
        >
          {error}
        </div>
      )}

      {sites.length === 0 &&
        !loading && (
          <section className="card">
            <h2>
              No hay sitios registrados
            </h2>

            <p>
              Primero debes registrar un
              sitio para poder crear áreas.
            </p>
          </section>
        )}

      {sites.length > 0 && (
        <>
          <section
            style={{
              marginBottom: '24px',
              padding: '20px',
              borderRadius: '12px',
              border:
                '1px solid #d1d5db',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <label>
              Sitio
              <select
                value={selectedSiteId}
                onChange={(event) =>
                  setSelectedSiteId(
                    event.target.value,
                  )
                }
              >
                {sites.map((site) => (
                  <option
                    key={site.id}
                    value={site.id}
                  >
                    {site.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={openCreateForm}
            >
              + Nueva área
            </button>
          </section>

          {showForm && (
            <section
              style={{
                marginBottom: '24px',
                padding: '24px',
                borderRadius: '12px',
                border:
                  '1px solid #d1d5db',
              }}
            >
              <p className="eyebrow">
                {editingArea
                  ? 'EDITAR ÁREA'
                  : 'NUEVA ÁREA'}
              </p>

              <h2>
                {editingArea
                  ? editingArea.name
                  : 'Registrar área'}
              </h2>

              {formError && (
                <div
                  style={{
                    marginBottom: '16px',
                    padding:
                      '10px 14px',
                    borderRadius: '8px',
                    border:
                      '1px solid #dc2626',
                  }}
                >
                  {formError}
                </div>
              )}

              <form
                onSubmit={handleSubmit}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '16px',
                  }}
                >
                  <label>
                    Sitio
                    <select
                      value={form.siteId}
                      disabled={
                        !!editingArea
                      }
                      onChange={(event) =>
                        handleChange(
                          'siteId',
                          event.target.value,
                        )
                      }
                    >
                      {sites.map(
                        (site) => (
                          <option
                            key={site.id}
                            value={site.id}
                          >
                            {site.name}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label>
                    Nombre
                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) =>
                        handleChange(
                          'name',
                          event.target.value,
                        )
                      }
                      placeholder="Lobby"
                    />
                  </label>

                  <label>
                    Tipo
                    <input
                      type="text"
                      value={form.type}
                      onChange={(event) =>
                        handleChange(
                          'type',
                          event.target.value,
                        )
                      }
                      placeholder="Área común"
                    />
                  </label>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '12px',
                    marginTop: '20px',
                  }}
                >
                  <button
                    type="submit"
                    disabled={saving}
                  >
                    {saving
                      ? 'Guardando...'
                      : editingArea
                        ? 'Guardar cambios'
                        : 'Crear área'}
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={closeForm}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </section>
          )}

          {loading ? (
            <p>
              Cargando áreas...
            </p>
          ) : areas.length === 0 ? (
            <section className="card">
              <h2>
                No hay áreas registradas
              </h2>

              <p>
                {selectedSite
                  ? `El sitio "${selectedSite.name}" todavía no tiene áreas.`
                  : 'Selecciona un sitio.'}
              </p>
            </section>
          ) : (
            <section className="sites-grid">
              {areas.map((area) => (
                <article
                  className="site-card"
                  key={area.id}
                >
                  <div className="site-card-header">
                    <div>
                      <p className="site-code">
                        {area.type ??
                          'ÁREA'}
                      </p>

                      <h2>
                        {area.name}
                      </h2>
                    </div>
                  </div>

                  <p className="site-location">
                    {selectedSite?.name ??
                      'Sitio'}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      marginTop: '18px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        openEditForm(
                          area,
                        )
                      }
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(
                          area,
                        )
                      }
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  )
}

export default AreasPage