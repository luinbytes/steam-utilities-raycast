import {
  Action,
  ActionPanel,
  Alert,
  Color,
  Icon,
  List,
  Toast,
  showToast,
  confirmAlert,
  LocalStorage,
  Clipboard,
} from "@raycast/api";
import { join } from "path";
import { existsSync } from "fs";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  launchSteamGame,
  listInstalledGames,
  getSteamInstallPath,
  restartSteam,
  openSteam,
  getSteamUserDisplayName,
  getCurrentSteamUser,
  openSteamConfigFolder,
  SteamGame,
} from "./utils/steam";
import { executeCommand, showFailure } from "./utils";

interface GameItem {
  id: string;
  title: string;
  subtitle?: string;
  appid: string;
  libraryPath: string;
  installdir: string;
  name: string;
  installed: boolean;
  lastOwner?: string;
  lastOwnerName?: string;
  sizeBytes?: number;
  lastPlayed?: Date;
  playtimeMinutes?: number;
  genre?: string[];
  categories?: string[];
  developer?: string;
  keywords?: string[];
  isFavorite?: boolean;
  hasCloudSaves?: boolean;
  isUpdating?: boolean;
  achievements?: {
    total: number;
    unlocked: number;
  };
}

export default function Command() {
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GameItem[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [refreshTick, setRefreshTick] = useState(0);
  const [filterMode, setFilterMode] = useState<"all" | "drive" | "alphabetical" | "recent" | "favorites">("drive");
  // Track the currently selected dropdown value so Sort selections are reflected in the UI
  const [dropdownValue, setDropdownValue] = useState<string>("drive");
  const [sortMode, setSortMode] = useState<"name" | "playtime" | "lastPlayed" | "size">("name");
  const [currentUser, setCurrentUser] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<"grid" | "detail">("detail");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recentGames, setRecentGames] = useState<GameItem[]>([]);

  // Load favorites from LocalStorage
  useEffect(() => {
    async function loadFavorites() {
      try {
        const storedFavorites = await LocalStorage.getItem<string>("steam-favorites");
        if (storedFavorites) {
          setFavorites(new Set(JSON.parse(storedFavorites)));
        }
      } catch {
        // Ignore errors loading favorites
      }
    }
    loadFavorites();
  }, []);


  // Load persisted filter/sort/dropdown selection on startup
  useEffect(() => {
    (async () => {
      try {
        const savedFilter = await LocalStorage.getItem<string>("steam-filter-mode");
        if (savedFilter && ["all", "drive", "alphabetical", "recent", "favorites"].includes(savedFilter)) {
          setFilterMode(savedFilter as typeof filterMode);
        }
        const savedSort = await LocalStorage.getItem<string>("steam-sort-mode");
        if (savedSort && ["name", "playtime", "lastPlayed", "size"].includes(savedSort)) {
          setSortMode(savedSort as typeof sortMode);
        }
        const savedDropdown = await LocalStorage.getItem<string>("steam-dropdown-value");
        const allowedDropdown = [
          "all",
          "drive",
          "alphabetical",
          "recent",
          "favorites",
          "name",
          "playtime",
          "lastPlayed",
          "size",
        ];
        if (savedDropdown && allowedDropdown.includes(savedDropdown)) {
          setDropdownValue(savedDropdown);
        } else if (savedSort && ["name", "playtime", "lastPlayed", "size"].includes(savedSort || "")) {
          setDropdownValue(savedSort!);
        } else if (savedFilter && ["all", "drive", "alphabetical", "recent", "favorites"].includes(savedFilter || "")) {
          setDropdownValue(savedFilter!);
        }
      } catch {
        // ignore persistence errors
      }
    })();
  }, []);

  // Persist filter/sort/dropdown selection when changed
  useEffect(() => {
    LocalStorage.setItem("steam-filter-mode", filterMode);
  }, [filterMode]);

  useEffect(() => {
    LocalStorage.setItem("steam-sort-mode", sortMode);
  }, [sortMode]);

  useEffect(() => {
    LocalStorage.setItem("steam-dropdown-value", dropdownValue);
  }, [dropdownValue]);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(undefined);
      try {
        const paths = await getSteamInstallPath();
        if (!paths) {
          setError("Steam installation not found. Is Steam installed?");
          setItems([]);
          return;
        }
        // Get current Steam user for better filtering
        const currentSteamUser = await getCurrentSteamUser(paths);
        setCurrentUser(currentSteamUser);

        const games = await listInstalledGames(paths.steamPath);
        const mapped: GameItem[] = await Promise.all(games
          .filter((g) => g.installed)
          .map(async (g) => {
            // Resolve username for last owner
            let lastOwnerName = g.lastOwner;
            if (g.lastOwner) {
              try {
                lastOwnerName = await getSteamUserDisplayName(g.lastOwner, paths);
              } catch {
                // Keep original ID if resolution fails
              }
            }

            // Calculate game size and add keywords for better search
            const gamePath = join(g.libraryPath, "steamapps", "common", g.installdir);
            let sizeBytes = 0;
            try {
              if (existsSync(gamePath)) {
                // For performance, we'll skip actual size calculation for now
                // sizeBytes = await getDirectorySize(gamePath);
              }
            } catch {
              // Ignore size calculation errors
            }

            // Generate mock playtime data (in real implementation, parse from Steam files)
            const playtimeMinutes = Math.floor(Math.random() * 10000); // Mock data
            const lastPlayed = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Random within 30 days
            
            // Mock categories (in real implementation, parse from Steam VDF)
            const categories = ["Action", "Adventure", "Indie", "Strategy", "RPG", "Simulation"][Math.floor(Math.random() * 6)];
            
            // Check if favorited
            const isFavorite = favorites.has(g.appid);
            
            // Mock cloud saves and achievement data
            const hasCloudSaves = Math.random() > 0.3;
            const achievements = {
              total: Math.floor(Math.random() * 50) + 10,
              unlocked: Math.floor(Math.random() * 30)
            };

            // Generate search keywords
            const keywords = [
              g.name.toLowerCase(),
              g.appid,
              lastOwnerName?.toLowerCase() || "",
              driveOf(g.libraryPath)?.toLowerCase() || "",
              categories?.toLowerCase() || "",
            ].filter(Boolean);

            return {
              id: g.appid,
              title: g.name,
              appid: g.appid,
              libraryPath: g.libraryPath,
              installdir: g.installdir,
              name: g.name,
              installed: g.installed,
              lastOwner: g.lastOwner,
              lastOwnerName,
              sizeBytes,
              lastPlayed,
              playtimeMinutes,
              categories: [categories],
              keywords,
              isFavorite,
              hasCloudSaves,
              achievements,
              isUpdating: Math.random() > 0.9, // 10% chance of updating
            };
          }));
        // Set recent games (most recently played)
        const recent = mapped
          .filter(g => g.lastPlayed)
          .sort((a, b) => (b.lastPlayed?.getTime() || 0) - (a.lastPlayed?.getTime() || 0))
          .slice(0, 10);
        setRecentGames(recent);
        
        mapped.sort((a, b) => a.title.localeCompare(b.title));
        // Prefer selecting the first game immediately so the initial selection isn't an action
        if (mapped.length > 0) {
          setSelectedId(mapped[0].id);
        }
        setItems(mapped);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg || "Failed to list Steam games");
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [refreshTick, favorites, sortMode]);

  // Save favorites to LocalStorage
  const toggleFavorite = async (appid: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(appid)) {
      newFavorites.delete(appid);
    } else {
      newFavorites.add(appid);
    }
    setFavorites(newFavorites);
    await LocalStorage.setItem("steam-favorites", JSON.stringify([...newFavorites]));
  };

  // Format playtime
  const formatPlaytime = (minutes?: number): string => {
    if (!minutes || minutes === 0) return "Never played";
    const hours = Math.floor(minutes / 60);
    if (hours === 0) return `${minutes}m`;
    if (hours < 10) return `${hours}h ${minutes % 60}m`;
    return `${hours}h`;
  };

  // Format file size
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "Unknown";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };


  function driveOf(p: string): string | undefined {
    const m = /^[A-Za-z]:/.exec(p);
    return m ? m[0].toUpperCase() : undefined;
  }

  function driveColor(drive: string): Color {
    const letter = drive[0]?.toUpperCase();
    switch (letter) {
      case "C":
        return Color.Green;
      case "D":
        return Color.Blue;
      case "E":
        return Color.Purple;
      case "F":
        return Color.Magenta;
      case "G":
        return Color.Orange;
      default:
        return Color.Yellow;
    }
  }

  // Derive unique Steam library root paths from listed games
  const libraryRoots = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.libraryPath) set.add(it.libraryPath);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  async function openFolder(p: string) {
    // Using 'start' avoids Explorer returning a non-zero exit code even when it opens successfully
    await executeCommand(`start "" "${p}"`);
  }


  const actionItems = useMemo(() => {
    const base = [
      {
        key: "open",
        title: "Open Steam",
        icon: Icon.AppWindow,
        action: () => openSteam(),
      },
      {
        key: "restart",
        title: "Restart Steam",
        icon: Icon.ArrowClockwise,
        action: async () => {
          const ok = await confirmAlert({
            title: "Restart Steam?",
            primaryAction: {
              title: "Restart",
              style: Alert.ActionStyle.Destructive,
            },
            icon: Icon.ArrowClockwise,
          });
          if (!ok) return;
          await restartSteam();
        },
      },
    ];
    const libActions = libraryRoots.map((p, idx) => ({
      key: `open-common-${idx}`,
      title: `Open Game Files (${p})`,
      icon: Icon.Folder,
      action: async () => {
        const common = join(p, "steamapps", "common");
        await openFolder(common);
      },
    }));
    if (libActions.length === 0) {
      // Fallback to default Steam install path
      base.push({
        key: "open-common-default",
        title: "Open Game Files (Default)",
        icon: Icon.Folder,
        action: async () => {
          const paths = await getSteamInstallPath();
          if (paths) {
            await openFolder(join(paths.steamPath, "steamapps", "common"));
          }
        },
      });
    }
    return [...base, ...libActions];
  }, [libraryRoots]);

  const filteredActions = useMemo(() => {
    if (!query) return actionItems;
    const q = query.toLowerCase();
    return actionItems.filter((a) => a.title.toLowerCase().includes(q));
  }, [actionItems, query]);

  // Group games by library/drive for dynamic categorization
  const gamesByLibrary = useMemo(() => {
    const grouped: Record<string, GameItem[]> = {};

    items.forEach(game => {
      const drive = driveOf(game.libraryPath) || "Other";
      if (!grouped[drive]) {
        grouped[drive] = [];
      }
      grouped[drive].push(game);
    });

    // Sort games within each library alphabetically
    Object.keys(grouped).forEach(drive => {
      grouped[drive].sort((a, b) => a.title.localeCompare(b.title));
    });

    return grouped;
  }, [items]);

  // Smart categorization based on filter mode
  const categorizedGames = useMemo(() => {
    if (filterMode === "all") {
      return { "All Games": items };
    }

    if (filterMode === "favorites") {
      return { "Favorites": items.filter((g) => g.isFavorite) };
    }

    if (filterMode === "recent") {
      return { "Recent Games": recentGames };
    }

    if (filterMode === "alphabetical") {
      const grouped: Record<string, GameItem[]> = {};
      items.forEach(game => {
        const firstLetter = game.title.charAt(0).toUpperCase();
        const group = /[A-Z]/.test(firstLetter) ? firstLetter : "#";
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(game);
      });
      return grouped;
    }

    // Size grouping removed - fallback to drive-based
    return gamesByLibrary;

    // Default to drive-based categorization
    return gamesByLibrary;
  }, [items, filterMode, gamesByLibrary, recentGames]);

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase();
    let filtered = items.filter((g) => {
      if (!g.keywords) return true;
      return g.keywords.some((k) => k.includes(q));
    });

    // Apply filter mode
    switch (filterMode) {
      case "favorites":
        filtered = filtered.filter(g => g.isFavorite);
        break;
      case "recent":
        filtered = recentGames.filter(g => 
          !g.keywords || g.keywords.some((k) => k.includes(q))
        );
        break;
    }

    // Apply sorting
    switch (sortMode) {
      case "playtime":
        filtered.sort((a, b) => (b.playtimeMinutes || 0) - (a.playtimeMinutes || 0));
        break;
      case "lastPlayed":
        filtered.sort((a, b) => (b.lastPlayed?.getTime() || 0) - (a.lastPlayed?.getTime() || 0));
        break;
      case "size":
        filtered.sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0));
        break;
      default: // name
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    // Apply drive-based grouping if selected
    if (filterMode === "drive") {
      const drives = new Set(filtered.map((g) => driveOf(g.libraryPath)));
      const sorted: GameItem[] = [];
      for (const drive of Array.from(drives).sort()) {
        const gamesOnDrive = filtered.filter((g) => driveOf(g.libraryPath) === drive);
        gamesOnDrive.sort((a, b) => a.title.localeCompare(b.title));
        sorted.push(...gamesOnDrive);
      }
      return sorted;
    } else if (filterMode === "alphabetical") {
      return filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      return filtered;
    }
  }, [items, query, filterMode, sortMode, recentGames]);

  // Ensure selection starts at the very first item (Games > Actions)
  const initialSelectionDone = useRef(false);
  useEffect(() => {
    if (initialSelectionDone.current) return;
    const firstGame = filteredItems[0]?.id;
    const firstAction = filteredActions[0] ? `act-${filteredActions[0].key}` : undefined;
    const target = firstGame || firstAction;
    if (target && selectedId !== target) {
      setSelectedId(target);
      initialSelectionDone.current = true;
    }
  }, [filteredItems, filteredActions, selectedId]);

  async function onLaunch(g: GameItem) {
    try {
      await showToast({
        style: Toast.Style.Animated,
        title: `Launching ${g.title}...`,
      });
      await launchSteamGame(g.appid);
      await showToast({ 
        style: Toast.Style.Success, 
        title: `Launched ${g.title}`,
        message: "Game should start shortly"
      });
    } catch (e: unknown) {
      await showFailure(e, { title: `Launch failed: ${g.title}` });
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  async function refreshData() {
    setRefreshTick(prev => prev + 1);
    await showToast({
      style: Toast.Style.Animated,
      title: "Refreshing Steam games...",
    });
  }

  async function onSwitchAccount() {
    try {
      await showToast({
        style: Toast.Style.Animated,
        title: "Switching Steam account...",
      });
      await restartSteam();
      await showToast({
        style: Toast.Style.Success,
        title: "Steam restarted",
        message: "You can now login with a different account"
      });
    } catch (e: unknown) {
      await showFailure(e, { title: "Failed to restart Steam" });
    }
  }

  async function onOpenFolder(g: GameItem) {
    const full = join(g.libraryPath, "steamapps", "common", g.installdir);
    try {
      if (!existsSync(full)) {
        await showFailure(`Folder not found: ${full}`, {
          title: "Folder not found",
        });
        return;
      }
      // Use Windows 'start' for better reliability from Node
      await executeCommand(`start "" "${full}"`);
    } catch (e: unknown) {
      await showFailure(e, { title: "Failed to open folder" });
    }
  }


  return (
    <List
      key={`list-${refreshTick}`}
      isLoading={isLoading}
      searchBarPlaceholder="Search games by name, App ID, drive, or owner..."
      onSearchTextChange={setQuery}
      searchText={query}
      selectedItemId={selectedId}
      onSelectionChange={(id) => setSelectedId(id ?? undefined)}
      isShowingDetail={viewMode === "detail" && !selectedId?.startsWith("act-")}
      throttle
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter & Sort Games"
          storeValue={true}
          onChange={(newValue) => {
            setDropdownValue(newValue);
            if (["all", "drive", "alphabetical", "recent", "favorites"].includes(newValue)) {
              setFilterMode(newValue as typeof filterMode);
            } else {
              setSortMode(newValue as typeof sortMode);
            }
          }}
          value={dropdownValue}
        >
          <List.Dropdown.Section title="Filter">
            <List.Dropdown.Item title="Recent Games" value="recent" icon={Icon.Clock} />
            <List.Dropdown.Item title="Favorites" value="favorites" icon={Icon.Heart} />
            <List.Dropdown.Item title="By Drive" value="drive" icon={Icon.HardDrive} />
            <List.Dropdown.Item title="All Games" value="all" icon={Icon.List} />
            <List.Dropdown.Item title="Alphabetical" value="alphabetical" icon={Icon.Text} />
          </List.Dropdown.Section>
          <List.Dropdown.Section title="Sort">
            <List.Dropdown.Item title="Sort by Playtime" value="playtime" icon={Icon.Clock} />
            <List.Dropdown.Item title="Sort by Last Played" value="lastPlayed" icon={Icon.Calendar} />
            <List.Dropdown.Item title="Sort by File Size" value="size" icon={Icon.HardDrive} />
            <List.Dropdown.Item title="Sort by Name" value="name" icon={Icon.Text} />
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      {error && (
        <List.EmptyView
          title="Steam Error"
          description={error}
          icon={{ source: Icon.ExclamationMark, tintColor: Color.Red }}
          actions={
            <ActionPanel>
              <Action
                title="Refresh"
                onAction={refreshData}
                icon={Icon.ArrowClockwise}
                shortcut={{ modifiers: ["ctrl"], key: "r" }}
              />
              <Action
                title="Open Steam"
                onAction={openSteam}
                icon={Icon.AppWindow}
              />
            </ActionPanel>
          }
        />
      )}

      {Object.keys(categorizedGames).length > 0 && (
        <>
          {Object.entries(categorizedGames)
            .filter(([category, games]) =>
              !query || games.some((g: GameItem) => g.title.toLowerCase().includes(query.toLowerCase()))
            )
            .sort(([a], [b]) => {
              // Sort categories intelligently
              if (filterMode === "alphabetical") return a.localeCompare(b);
              if (filterMode === "drive") {
                // Keep drive order as-is for familiarity
                return a.localeCompare(b);
              }
              return a.localeCompare(b);
            })
            .map(([category, games]) => {
              const filteredGames = query
                ? games.filter((g: GameItem) => g.title.toLowerCase().includes(query.toLowerCase()))
                : games;

              if (filteredGames.length === 0) return null;

              // Apply item sorting per-section so UI reflects selected sortMode
              const sortedGames = [...filteredGames];
              switch (sortMode) {
                case "playtime":
                  sortedGames.sort((a, b) => (b.playtimeMinutes || 0) - (a.playtimeMinutes || 0));
                  break;
                case "lastPlayed":
                  sortedGames.sort((a, b) => (b.lastPlayed?.getTime() || 0) - (a.lastPlayed?.getTime() || 0));
                  break;
                case "size":
                  sortedGames.sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0));
                  break;
                default:
                  sortedGames.sort((a, b) => a.title.localeCompare(b.title));
                  break;
              }

              return (
                <List.Section
                  key={category}
                  title={
                    filterMode === "alphabetical"
                      ? `${category} (${filteredGames.length})`
                      : filterMode === "all"
                      ? `All Games (${filteredGames.length})`
                      : filterMode === "drive"
                      ? `${category} Drive (${filteredGames.length})`
                      : `${category} (${filteredGames.length})`
                  }
                  subtitle={
                    filterMode === "drive"
                      ? `${filteredGames.length} game${filteredGames.length === 1 ? '' : 's'}`
                      : undefined
                  }
                >
                {sortedGames.map((g: GameItem) => {
                  const drive = driveOf(g.libraryPath);
                  const accessories = viewMode === "detail" ? [] : [
                    ...(g.categories?.[0] ? [{ tag: { value: g.categories[0], color: Color.SecondaryText } }] : []),
                    { tag: { value: formatPlaytime(g.playtimeMinutes), color: Color.SecondaryText } },
                    ...(drive ? [{ tag: { value: drive, color: driveColor(drive) } }] : []),
                    ...(g.isFavorite ? [{ icon: { source: Icon.Heart, tintColor: Color.Red } }] : []),
                    ...(g.isUpdating ? [{ icon: { source: Icon.Download, tintColor: Color.Blue } }] : []),
                    ...(g.hasCloudSaves ? [{ icon: { source: Icon.Cloud, tintColor: Color.Green } }] : [])
                  ];

                  return (
                    <List.Item
                      key={g.id}
                      id={g.id}
                      title={g.title}
                      subtitle={undefined}
                      icon={{
                        source: g.isFavorite ? Icon.Heart : Icon.GameController,
                        tintColor: g.isFavorite ? Color.Red : (g.lastOwner === currentUser ? Color.Green : Color.SecondaryText)
                      }}
                      keywords={g.keywords}
                      accessories={accessories}
                      detail={viewMode === "detail" ? (
                        <List.Item.Detail
                          markdown={`# ${g.name}

<img src="https://steamcdn-a.akamaihd.net/steam/apps/${g.appid}/header.jpg" width="320" />

## Game Information

**App ID:** \`${g.appid}\`  
**Category:** ${g.categories?.[0] || 'Unknown'}  
**Playtime:** ${formatPlaytime(g.playtimeMinutes)}  
**Install Drive:** ${drive || "Unknown"}  
**Install Location:** \`${g.libraryPath}\`  
**Game Directory:** \`${g.installdir}\`  

${g.achievements ? `**Achievements:** ${g.achievements.unlocked}/${g.achievements.total} unlocked (${Math.round((g.achievements.unlocked / g.achievements.total) * 100)}%)` : ''}

---

### Quick Actions
- **Enter** - Launch Game
- **Ctrl + F** - Open Game Folder  
- **Ctrl + C** - Copy App ID
- **Ctrl + S** - Steam Store Page
- **Ctrl + H** - ${g.isFavorite ? 'Remove from' : 'Add to'} Favorites
- **Ctrl + B** - Launch in Big Picture Mode

${g.lastOwnerName && g.lastOwnerName !== currentUser ? `
**⚠️ Note:** This game was last played by **${g.lastOwnerName}**` : ''}

*Steam Game managed by Raycast*`}
                            metadata={
                              <List.Item.Detail.Metadata>
                                {/* Top priority status section */}
                                <List.Item.Detail.Metadata.Label 
                                  title="Status" 
                                  text={g.installed ? "✅ Installed" : "❌ Not Installed"} 
                                  icon={g.installed ? Icon.CheckCircle : Icon.XMarkCircle}
                                />
                                <List.Item.Detail.Metadata.Label 
                                  title="Favorite" 
                                  text={g.isFavorite ? "❤️ Yes" : "🤍 No"} 
                                  icon={g.isFavorite ? Icon.Heart : Icon.HeartDisabled}
                                />
                                <List.Item.Detail.Metadata.Label 
                                  title="Steam Cloud" 
                                  text={g.hasCloudSaves ? "☁️ Enabled" : "📱 Local Only"} 
                                  icon={g.hasCloudSaves ? Icon.Cloud : Icon.HardDrive}
                                />
                                {g.achievements && (
                                  <List.Item.Detail.Metadata.Label 
                                    title="Achievements" 
                                    text={`${g.achievements.unlocked}/${g.achievements.total} (${Math.round((g.achievements.unlocked / g.achievements.total) * 100)}%)`} 
                                    icon={Icon.Trophy}
                                  />
                                )}
                                <List.Item.Detail.Metadata.Separator />

                                {/* General info */}
                                <List.Item.Detail.Metadata.Label title="App ID" text={g.appid} icon={Icon.Hashtag} />
                                <List.Item.Detail.Metadata.Label title="Category" text={g.categories?.[0] || 'Unknown'} icon={Icon.Tag} />
                                <List.Item.Detail.Metadata.Label title="Playtime" text={formatPlaytime(g.playtimeMinutes)} icon={Icon.Clock} />
                                <List.Item.Detail.Metadata.Separator />

                                {/* Installation */}
                                <List.Item.Detail.Metadata.Label title="Install Drive" text={drive || "Unknown"} icon={Icon.HardDrive} />
                                <List.Item.Detail.Metadata.Label 
                                  title="Install Directory" 
                                  text={join(g.libraryPath, "steamapps", "common", g.installdir)} 
                                  icon={Icon.Folder}
                                />
                                {g.lastOwnerName ? (
                                  <List.Item.Detail.Metadata.Label 
                                    title="Last Owner" 
                                    text={g.lastOwnerName} 
                                    icon={Icon.Person}
                                  />
                                ) : null}
                                <List.Item.Detail.Metadata.Separator />

                                {/* Dynamic state / size */}
                                {g.isUpdating && (
                                  <List.Item.Detail.Metadata.Label 
                                    title="Update Status" 
                                    text="🔄 Updating..." 
                                    icon={Icon.Download}
                                  />
                                )}
                                {g.sizeBytes && g.sizeBytes > 0 ? (
                                  <List.Item.Detail.Metadata.Label 
                                    title="Size" 
                                    text={formatFileSize(g.sizeBytes)} 
                                    icon={Icon.HardDrive}
                                  />
                                ) : null}
                              </List.Item.Detail.Metadata>
                            }
                          />
                        ) : undefined}
                        actions={
                          <ActionPanel>
                            <ActionPanel.Section title="Game Actions">
                              <Action
                                title="Launch Game"
                                onAction={() => onLaunch(g)}
                                icon={Icon.Play}
                              />
                              <Action
                                title="Open Game Folder"
                                onAction={() => openFolder(join(g.libraryPath, "steamapps", "common", g.installdir))}
                                icon={Icon.Folder}
                                shortcut={{ modifiers: ["ctrl"], key: "f" }}
                              />
                              <Action
                                title="Launch in Big Picture Mode"
                                onAction={async () => {
                                  try {
                                    await executeCommand(`start "" "steam://open/bigpicture"`);
                                    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for Big Picture to load
                                    await executeCommand(`start "" "steam://rungameid/${g.appid}"`);
                                  } catch {
                                    await showToast({ style: Toast.Style.Failure, title: "Failed to launch Big Picture" });
                                  }
                                }}
                                icon={Icon.Monitor}
                                shortcut={{ modifiers: ["ctrl"], key: "b" }}
                              />
                              <Action
                                title={g.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                                onAction={() => toggleFavorite(g.appid)}
                                icon={g.isFavorite ? Icon.HeartDisabled : Icon.Heart}
                                shortcut={{ modifiers: ["ctrl"], key: "h" }}
                              />
                            </ActionPanel.Section>
                            <ActionPanel.Section title="Steam Actions">
                              <Action
                                title="Open Steam Store Page"
                                onAction={() => executeCommand(`start "" "https://store.steampowered.com/app/${g.appid}"`).catch(() => {})}
                                icon={Icon.Globe}
                                shortcut={{ modifiers: ["ctrl"], key: "s" }}
                              />
                              <Action
                                title="Copy App ID"
                                onAction={async () => {
                                  await Clipboard.copy(g.appid);
                                  await showToast({ style: Toast.Style.Success, title: "Copied App ID", message: g.appid });
                                }}
                                icon={Icon.Clipboard}
                                shortcut={{ modifiers: ["ctrl"], key: "c" }}
                              />
                            </ActionPanel.Section>
                            <ActionPanel.Section title="Quick Actions">
                              <Action
                                title="Copy Game Path"
                                onAction={async () => {
                                  const path = join(g.libraryPath, "steamapps", "common", g.installdir);
                                  await Clipboard.copy(path);
                                  await showToast({ style: Toast.Style.Success, title: "Copied Game Path", message: path });
                                }}
                                icon={Icon.Folder}
                              />
                              <Action
                                title="Copy Steam URL"
                                onAction={async () => {
                                  const url = `steam://rungameid/${g.appid}`;
                                  await Clipboard.copy(url);
                                  await showToast({ style: Toast.Style.Success, title: "Copied Steam URL", message: url });
                                }}
                                icon={Icon.Link}
                              />
                            </ActionPanel.Section>
                            <ActionPanel.Section title="View Options">
                              <Action
                                title="Toggle View Mode"
                                onAction={() => setViewMode(prev => prev === "detail" ? "grid" : "detail")}
                                icon={viewMode === "detail" ? Icon.List : Icon.AppWindowGrid3x3}
                                shortcut={{ modifiers: ["ctrl"], key: "d" }}
                              />
                              <Action
                                title="Refresh Games"
                                onAction={refreshData}
                                icon={Icon.ArrowClockwise}
                                shortcut={{ modifiers: ["ctrl"], key: "r" }}
                              />
                            </ActionPanel.Section>
                          </ActionPanel>
                        }
                      />
                    );
                  })}
                </List.Section>
              );
            })}
        </>
      )}

      {filteredItems.length === 0 && !isLoading && !error && (
        <List.EmptyView 
          title="No Steam Games Found" 
          description="No installed games match your search criteria"
          icon={{ source: Icon.MagnifyingGlass, tintColor: Color.SecondaryText }}
          actions={
            <ActionPanel>
              <Action
                title="Refresh Games"
                onAction={refreshData}
                icon={Icon.ArrowClockwise}
                shortcut={{ modifiers: ["ctrl"], key: "r" }}
              />
              <Action
                title="Open Steam"
                onAction={openSteam}
                icon={Icon.AppWindow}
                shortcut={{ modifiers: ["ctrl"], key: "o" }}
              />
              <Action
                title="Clear Search"
                onAction={() => setQuery("")}
                icon={Icon.XMarkCircle}
                shortcut={{ modifiers: ["ctrl"], key: "backspace" }}
              />
            </ActionPanel>
          }
        />
      )}

      {!isLoading && filteredActions.length > 0 && (
        <List.Section title="Steam Management">
          {filteredActions.map((a) => (
            <List.Item
              key={a.key}
              id={`act-${a.key}`}
              title={a.title}
              subtitle="System action"
              icon={{
                source: a.icon,
                tintColor: Color.Blue
              }}
              actions={
                <ActionPanel>
                  <ActionPanel.Section title="Steam Actions">
                    <Action 
                      title={a.title} 
                      onAction={a.action}
                      icon={a.icon}
                    />
                  </ActionPanel.Section>
                  <ActionPanel.Section title="Quick Actions">
                    <Action
                      title="Refresh Games"
                      onAction={refreshData}
                      icon={Icon.ArrowClockwise}
                      shortcut={{ modifiers: ["ctrl"], key: "r" }}
                    />
                    <Action
                      title="Open Steam"
                      onAction={openSteam}
                      icon={Icon.AppWindow}
                      shortcut={{ modifiers: ["ctrl"], key: "o" }}
                    />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}
