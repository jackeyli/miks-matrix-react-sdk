import DMRoomMap from './DMRoomMap';

/* For now, a cut-down type spec for the client */
interface Client {
    getUserId: () => string;
    checkUserTrust: (userId: string) => {
        isCrossSigningVerified: () => boolean
    };
    getStoredDevicesForUser: (userId: string) => Promise<[{ deviceId: string }]>;
    checkDeviceTrust: (userId: string, deviceId: string) => {
        isVerified: () => boolean
    }
}

interface Room {
    getEncryptionTargetMembers: () => Promise<[{userId: string}]>;
    roomId: string;
}

export async function shieldStatusForMembership(client: Client, room: Room): Promise<string> {
    const members = (await room.getEncryptionTargetMembers()).map(({userId}) => userId);
    const inDMMap = !!DMRoomMap.shared().getUserIdForRoomId(room.roomId);

    const verified: string[] = [];
    const unverified: string[] = [];
    members.filter((userId) => userId !== client.getUserId())
        .forEach((userId) => {
            (client.checkUserTrust(userId).isCrossSigningVerified() ?
            verified : unverified).push(userId);
        });

    /* Check all verified user devices. */
    /* Don't alarm if no other users are verified  */
    const includeUser = (verified.length > 0) &&    // Don't alarm for self in rooms where nobody else is verified
                        !inDMMap &&                 // Don't alarm for self in DMs with other users
                        (members.length !== 2) || // Don't alarm for self in 1:1 chats with other users
                        (members.length === 1);   // Do alarm for self if we're alone in a room
    const targets = includeUser ? [...verified, client.getUserId()] : verified;
    for (const userId of targets) {
        const devices = await client.getStoredDevicesForUser(userId);
        const anyDeviceNotVerified = devices.some(({deviceId}) => {
            return !client.checkDeviceTrust(userId, deviceId).isVerified();
        });
        if (anyDeviceNotVerified) {
            return "warning";
        }
    }

    return unverified.length === 0 ? "verified" : "normal";
}
