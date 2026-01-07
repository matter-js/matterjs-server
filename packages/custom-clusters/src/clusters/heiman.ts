import { attribute, cluster, uint32 } from "@matter/main/model";

@cluster(0x120bfc01)
export class HeimanCluster {
    @attribute(0x00120b0010, uint32)
    tamperAlarm?: number;

    @attribute(0x00120b0011, uint32)
    preheatingState?: number;

    @attribute(0x00120b0012, uint32)
    noDisturbingState?: number;

    @attribute(0x00120b0013, uint32)
    sensorType?: number;

    @attribute(0x00120b0014, uint32)
    sirenActive?: number;

    @attribute(0x00120b0015, uint32)
    alarmMute?: number;

    @attribute(0x00120b0016, uint32)
    lowPowerMode?: number;
}
