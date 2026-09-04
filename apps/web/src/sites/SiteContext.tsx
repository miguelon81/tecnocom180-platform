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

  /*
   * Todos los sitios a los que el usuario
   * tiene acceso.
   *
   * SUPER_ADMIN:
   *   todos los sitios.
   *
   * Otros roles:
   *   solamente los sitios de su organización.
   */
  const [allSites, setAllSites] =
    useState<Site[]>([])

  /*
   * Sitios correspondientes a la organización
   * actualmente seleccionada.
   *
   * Este es el arreglo que exponemos mediante
   * useSites().
   */
  const [sites, setSites] =
    useState<Site[]>([])

  const [
    selectedOrganizationId,
    setSelectedOrganizationIdState,
  ] = useState<string | null>(null)

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

  // ============================================================
  // REFRESH
  // ============================================================

  async function refreshSites() {
    if (!user) {
      setOrganizations([])
      setAllSites([])
      setSites([])
      setSelectedOrganizationIdState(null)
      setSelectedSiteIdState(null)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const siteData = await getSites()

      let availableOrganizations: Organization[] = []
      let availableSites: Site[] = []

      if (isSuperAdmin) {
        /*
         * SUPER_ADMIN:
         *
         * - todas las organizaciones
         * - todos los sitios
         */
        availableOrganizations =
          await getOrganizations()

        availableSites = siteData
      } else {
        /*
         * Usuarios de organización:
         *
         * solamente conservamos los sitios
         * pertenecientes a su organización.
         */
        availableSites = siteData.filter(
          (site) =>
            site.organizationId ===
            userOrganizationId,
        )

        /*
         * Obtenemos la organización desde alguno
         * de los sitios disponibles.
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

      setAllSites(
        availableSites,
      )

      // ========================================================
      // ORGANIZACIÓN SELECCIONADA
      // ========================================================

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
          Boolean(
            storedOrganizationId &&
              availableOrganizations.some(
                (organization) =>
                  organization.id ===
                    storedOrganizationId &&
                  organization.active,
              ),
          )

        if (
          storedOrganizationIsValid &&
          storedOrganizationId
        ) {
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

      // ========================================================
      // SITIOS DE LA ORGANIZACIÓN
      // ========================================================

      const organizationSites =
        organizationToUse
          ? availableSites.filter(
              (site) =>
                site.organizationId ===
                organizationToUse,
            )
          : []

      setSites(organizationSites)

      // ========================================================
      // SITIO SELECCIONADO
      // ========================================================

      if (!organizationToUse) {
        setSelectedSiteIdState(null)
        return
      }

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
        Boolean(
          storedSiteId &&
            organizationSites.some(
              (site) =>
                site.id === storedSiteId &&
                site.active,
            ),
        )

      if (
        storedSiteIsValid &&
        storedSiteId
      ) {
        setSelectedSiteIdState(
          storedSiteId,
        )

        return
      }

      const firstActiveSite =
        organizationSites.find(
          (site) => site.active,
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
        setSelectedSiteIdState(null)

        localStorage.removeItem(
          siteStorageKey,
        )
      }
    } catch (err) {
      setOrganizations([])
      setAllSites([])
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

  // ============================================================
  // USUARIO
  // ============================================================

  useEffect(() => {
    void refreshSites()
  }, [
    user?.id,
    user?.organizationId,
    user?.role,
  ])

  // ============================================================
  // CAMBIAR ORGANIZACIÓN
  // ============================================================

  function setSelectedOrganizationId(
    organizationId: string,
  ) {
    if (!user) {
      return
    }

    /*
     * Solamente SUPER_ADMIN puede cambiar
     * manualmente de organización.
     */
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

    /*
     * Ahora filtramos desde allSites,
     * NO desde sites.
     *
     * allSites conserva todos los sitios
     * accesibles por SUPER_ADMIN.
     */
    const organizationSites =
      allSites.filter(
        (site) =>
          site.organizationId ===
          organizationId,
      )

    setSelectedOrganizationIdState(
      organizationId,
    )

    setSites(
      organizationSites,
    )

    localStorage.setItem(
      getOrganizationStorageKey(
        user.id,
      ),
      organizationId,
    )

    // ========================================================
    // RECUPERAR SITIO ANTERIOR DE ESTA ORGANIZACIÓN
    // ========================================================

    const siteStorageKey =
      getSiteStorageKey(
        user.id,
        organizationId,
      )

    const storedSiteId =
      localStorage.getItem(
        siteStorageKey,
      )

    const storedSiteIsValid =
      Boolean(
        storedSiteId &&
          organizationSites.some(
            (site) =>
              site.id === storedSiteId &&
              site.active,
          ),
      )

    if (
      storedSiteIsValid &&
      storedSiteId
    ) {
      setSelectedSiteIdState(
        storedSiteId,
      )

      return
    }

    /*
     * Si nunca habíamos trabajado con esta
     * organización, seleccionamos su primer
     * sitio activo.
     */
    const firstActiveSite =
      organizationSites.find(
        (site) => site.active,
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
      setSelectedSiteIdState(null)

      localStorage.removeItem(
        siteStorageKey,
      )
    }
  }

  // ============================================================
  // CAMBIAR SITIO
  // ============================================================

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

    setSelectedSiteIdState(
      siteId,
    )

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

  // ============================================================
  // SELECCIONES DERIVADAS
  // ============================================================

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

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

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

        allSites,
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