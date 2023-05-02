package io.github.keyboardcat1.minertc;

import java.util.HashMap;
import java.util.UUID;

public class TokenManager {
    private static final HashMap<UUID, String> uuidToToken = new HashMap<>();

    public static boolean login(UUID uuid, String token) {
        return uuidToToken.get(uuid).equals(token);
    }

    public static void register(UUID uuid, String token) {
        uuidToToken.put(uuid, token);
    }
}