import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { getSites } from '../api/sites'
import { getOrganizations } from '../api/organizations'

import type {
  Organization,
  Site,
} from '../types/site'

import { useAuth } from '../auth/AuthContext'

interface SiteContextValue {
  organizations: Organization[]
  selectedOrganizationId: string | null
  selectedOrganization: Organization | null

  sites: Site[]
  selectedSiteId: string | null
  selectedSite: Site | null

  loading: boolean
  error: string | null

  setSelectedOrganizationId: (
    organizationId: string,
  ) => void

  setSelectedSiteId: (
    siteId: string,
  ) => void

  refreshSites: () => Promise<void>
}

const SiteContext =
  createContext<SiteContextValue | undefined>(
    undefined,
  )

function getOrganizationStorageKey(
  userId: string,
) {
  return `tecnocom180_selected_organization_${userId}`
}

function getSiteStorageKey(
  userId: string,
  organizationId: string,
) {
  return `tecnocom180_selected_site_${userId}_${organizationId}`
}

export function SiteProvider({
  children,
}: {
  children: ReactNode
}) {
  const { user } = useAuth()

  const [organizations, setOrganizations] =
    useState<Organization[]>([])

  const [
    selectedOrganizationId,
    setSelectedOrganizationIdState,
  ] = useState<string | null>(null)

  const [sites, setSites] =
    useState<Site[]>([])

  const [
    selectedSiteId,
    setSelectedSiteIdState,
  ] = useState<string | null>(null)

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const isSuperAdmin =
    user?.role === 'SUPER_ADMIN'

  const userOrganizationId =
    user?.organizationId ?? null

  /*
   * Carga organizaciones y sitios.
   *
   * SUPER_ADMIN:
   *   puede ver todas las organizaciones.
   *
   * Los demás usuarios:
   *   solamente trabajan con su organización.
   */
  async function refreshSites() {
    if (!user) {
      setOrganizations([])
      setSites([])
      setSelectedOrganizationIdState(null)
      setSelectedSiteIdState(null)
      return
    }

    try {
      setLoading(true)
      setError(null)

      /*
       * CARGAR SITIOS
       *
       * El backend ya aplica el aislamiento.
       */
      const siteData = await getSites()

      let availableOrganizations: Organization[] = []
      let availableSites: Site[] = []

      if (isSuperAdmin) {
        /*
         * SUPER_ADMIN necesita conocer todas las
         * organizaciones para poder seleccionar una.
         */
        availableOrganizations =
          await getOrganizations()

        /*
         * El endpoint /sites para SUPER_ADMIN devuelve
         * todos los sitios.
         */
        availableSites = siteData
      } else {
        /*
         * Para usuarios normales solamente usamos
         * su organización.
         */
        availableSites = siteData.filter(
          (site) =>
            site.organizationId ===
            userOrganizationId,
        )

        /*
         * Construimos la organización actual
         * a partir de los sitios si está disponible.
         *
         * Si no tiene sitios, todavía mantenemos
         * la organización mediante el organizationId
         * del usuario.
         */
        const organizationFromSite =
          availableSites.find(
            (site) =>
              site.organizationId ===
              userOrganizationId,
          )?.organization

        if (organizationFromSite) {
          availableOrganizations = [
            organizationFromSite,
          ]
        }
      }

      setOrganizations(
        availableOrganizations,
      )

      /*
       * Determinar organización seleccionada.
       */
      let organizationToUse: string | null =
        null

      if (isSuperAdmin) {
        const organizationStorageKey =
          getOrganizationStorageKey(
            user.id,
          )

        const storedOrganizationId =
          localStorage.getItem(
            organizationStorageKey,
          )

        const storedOrganizationIsValid =
          storedOrganizationId &&
          availableOrganizations.some(
            (organization) =>
              organization.id ===
              storedOrganizationId &&
              organization.active,
          )

        if (storedOrganizationIsValid) {
          organizationToUse =
            storedOrganizationId
        } else {
          const firstActiveOrganization =
            availableOrganizations.find(
              (organization) =>
                organization.active,
            )

          organizationToUse =
            firstActiveOrganization?.id ??
            null

          if (organizationToUse) {
            localStorage.setItem(
              organizationStorageKey,
              organizationToUse,
            )
          } else {
            localStorage.removeItem(
              organizationStorageKey,
            )
          }
        }
      } else {
        organizationToUse =
          userOrganizationId
      }

      setSelectedOrganizationIdState(
        organizationToUse,
      )

      /*
       * Ahora filtramos los sitios según
       * la organización seleccionada.
       */
      const organizationSites =
        organizationToUse
          ? availableSites.filter(
              (site) =>
                site.organizationId ===
                organizationToUse,
            )
          : []

      setSites(organizationSites)

      /*
       * Recuperar el sitio seleccionado para
       * esta organización.
       */
      if (
        organizationToUse
      ) {
        const siteStorageKey =
          getSiteStorageKey(
            user.id,
            organizationToUse,
          )

        const storedSiteId =
          localStorage.getItem(
            siteStorageKey,
          )

        const storedSiteIsValid =
          storedSiteId &&
          organizationSites.some(
            (site) =>
              site.id ===
                storedSiteId &&
              site.active,
          )

        if (storedSiteIsValid) {
          setSelectedSiteIdState(
            storedSiteId,
          )
        } else {
          const firstActiveSite =
            organizationSites.find(
              (site) =>
                site.active,
            )

          if (firstActiveSite) {
            setSelectedSiteIdState(
              firstActiveSite.id,
            )

            localStorage.setItem(
              siteStorageKey,
              firstActiveSite.id,
            )
          } else {
            setSelectedSiteIdState(
              null,
            )

            localStorage.removeItem(
              siteStorageKey,
            )
          }
        }
      } else {
        setSelectedSiteIdState(null)
      }
    } catch (err) {
      setOrganizations([])
      setSites([])
      setSelectedOrganizationIdState(null)
      setSelectedSiteIdState(null)

      setError(
        err instanceof Error
          ? err.message
          : 'Error al cargar organizaciones y sitios',
      )
    } finally {
      setLoading(false)
    }
  }

  /*
   * Cuando cambia el usuario:
   *
   * - login
   * - logout
   * - cambio de usuario
   *
   * reconstruimos completamente el contexto.
   */
  useEffect(() => {
    void refreshSites()
  }, [
    user?.id,
    user?.organizationId,
    user?.role,
  ])

  /*
   * Selección de organización.
   *
   * Solamente SUPER_ADMIN puede cambiarla.
   */
  function setSelectedOrganizationId(
    organizationId: string,
  ) {
    if (!user) {
      return
    }

    if (!isSuperAdmin) {
      return
    }

    const organization =
      organizations.find(
        (item) =>
          item.id === organizationId &&
          item.active,
      )

    if (!organization) {
      return
    }

    setSelectedOrganizationIdState(
      organizationId,
    )

    localStorage.setItem(
      getOrganizationStorageKey(
        user.id,
      ),
      organizationId,
    )

    /*
     * Al cambiar organización, el sitio anterior
     * deja de ser válido.
     *
     * Seleccionamos automáticamente el primer
     * sitio activo de la nueva organización.
     */
    const organizationSites =
      sites.filter(
        (site) =>
          site.organizationId ===
          organizationId,
      )

    const firstActiveSite =
      organizationSites.find(
        (site) =>
          site.active,
      )

    if (firstActiveSite) {
      setSites(organizationSites)

      setSelectedSiteIdState(
        firstActiveSite.id,
      )

      localStorage.setItem(
        getSiteStorageKey(
          user.id,
          organizationId,
        ),
        firstActiveSite.id,
      )
    } else {
      /*
       * Si los sitios de la nueva organización
       * todavía no están en el estado actual,
       * refrescamos desde API.
       */
      setSites([])

      setSelectedSiteIdState(null)

      void refreshSites()
    }
  }

  /*
   * Selección de sitio.
   *
   * Siempre verificamos que el sitio:
   *
   * 1. exista en la lista actual
   * 2. esté activo
   * 3. pertenezca a la organización seleccionada
   */
  function setSelectedSiteId(
    siteId: string,
  ) {
    if (!user) {
      return
    }

    const site = sites.find(
      (item) =>
        item.id === siteId &&
        item.active,
    )

    if (!site) {
      return
    }

    if (
      selectedOrganizationId &&
      site.organizationId !==
        selectedOrganizationId
    ) {
      return
    }

    setSelectedSiteIdState(siteId)

    if (selectedOrganizationId) {
      localStorage.setItem(
        getSiteStorageKey(
          user.id,
          selectedOrganizationId,
        ),
        siteId,
      )
    }
  }

  const selectedOrganization =
    useMemo(
      () =>
        organizations.find(
          (organization) =>
            organization.id ===
            selectedOrganizationId,
        ) ?? null,
      [
        organizations,
        selectedOrganizationId,
      ],
    )

  const selectedSite =
    useMemo(
      () =>
        sites.find(
          (site) =>
            site.id ===
            selectedSiteId,
        ) ?? null,
      [
        sites,
        selectedSiteId,
      ],
    )

  const value =
    useMemo<SiteContextValue>(
      () => ({
        organizations,
        selectedOrganizationId,
        selectedOrganization,

        sites,
        selectedSiteId,
        selectedSite,

        loading,
        error,

        setSelectedOrganizationId,
        setSelectedSiteId,

        refreshSites,
      }),
      [
        organizations,
        selectedOrganizationId,
        selectedOrganization,

        sites,
        selectedSiteId,
        selectedSite,

        loading,
        error,
      ],
    )

  return (
    <SiteContext.Provider
      value={value}
    >
      {children}
    </SiteContext.Provider>
  )
}

export function useSites() {
  const context =
    useContext(SiteContext)

  if (!context) {
    throw new Error(
      'useSites must be used inside SiteProvider',
    )
  }

  return context
}