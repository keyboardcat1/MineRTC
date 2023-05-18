package io.github.keyboardcat1.minertc;

import java.util.HashMap;
import java.util.UUID;

/**
 * A static class to manage all the player tokens
 */
public final class TokenManager {
    private static final HashMap<UUID, String> uuidToToken = new HashMap<>();

    private TokenManager() {
    }

    /**
     * Checks whether a token corresponds to a player UUID
     * @param uuid The player UUID
     * @param token The token that we are testing against
     * @return {@code true} if the token corresponds, {@code false} otherwise
     */
    public static boolean login(UUID uuid, String token) {
        return uuidToToken.get(uuid).equals(token);
    }

    /**
     * Sets a player UUID to correspond to a token
     * @param uuid The player UUID
     * @param token The token
     */
    public static void register(UUID uuid, String token) {
        uuidToToken.put(uuid, token);
    }
}