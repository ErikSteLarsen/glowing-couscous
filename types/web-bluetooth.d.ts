/** Minimal Web Bluetooth surface used by TempoBuilder Ride (Chromium only). */
declare global {
  type BluetoothServiceUUID = number | string;
  type BluetoothCharacteristicUUID = number | string;

  interface BluetoothLEScanFilter {
    services?: BluetoothServiceUUID[];
    name?: string;
    namePrefix?: string;
  }

  interface RequestDeviceOptions {
    filters?: BluetoothLEScanFilter[];
    optionalServices?: BluetoothServiceUUID[];
    acceptAllDevices?: boolean;
  }

  interface BluetoothRemoteGATTCharacteristic extends EventTarget {
    readonly uuid: string;
    readonly value?: DataView;
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    readValue(): Promise<DataView>;
    writeValueWithResponse(value: BufferSource): Promise<void>;
    writeValue(value: BufferSource): Promise<void>;
  }

  interface BluetoothRemoteGATTService {
    readonly uuid: string;
    getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
  }

  interface BluetoothRemoteGATTServer {
    readonly connected: boolean;
    readonly device: BluetoothDevice;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
  }

  interface BluetoothDevice extends EventTarget {
    readonly id: string;
    readonly name?: string;
    readonly gatt?: BluetoothRemoteGATTServer;
  }

  interface Bluetooth {
    getAvailability?(): Promise<boolean>;
    requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
  }

  interface Navigator {
    readonly bluetooth?: Bluetooth;
  }
}

export {};
