//% color="#046307" weight=10 icon="\uf2db"
namespace DUELink {
    let _str_response: string
    let _value_response: number
    let _timeout: number
    let _doSync: boolean

    //% block="Set response timeout to %timeout milliseconds"
    //% timeout.defl=1000
    export function SetTimeout(timeout: number) {
        _timeout = timeout
    }
    //% block="Execute command %text return number"
    //% text.defl="dread(1,2)"
    export function ExecuteCommand(text: string ): number {
        if (!_doSync) {
            Sync() // sync first Execute
            _doSync = true
        }
               
        pins.i2cWriteBuffer(0x52, Buffer.fromUTF8(text), false);
        let buf = pins.createBuffer(1)
        buf[0] = 10
        pins.i2cWriteBuffer(0x52, buf)  

        let reponse = ReadResponse()

        if (reponse.trim() === "")
            return -1

        try {
            const ret = parseFloat(reponse);

            if (isNaN(ret)) {

                return -1;
            }

            return ret;
        }
        catch {
            return -1
        }
    }

    //% block="Execute command %text return string"
    //% text.defl="version()"
    export function ExecuteCommandRaw(text: string): string {
        if (!_doSync) {
            Sync() // sync first Execute
            _doSync = true
        }

        pins.i2cWriteBuffer(0x52, Buffer.fromUTF8(text), false);
        let buf2 = pins.createBuffer(1)
        buf2[0] = 10
        pins.i2cWriteBuffer(0x52, buf2)
        return ReadResponse()
    }

    //% block="Execute command %text"
    //% text.defl="statled(100,100,10)"
    export function ExecuteCommandNoReturn(text: string): void {
        if (!_doSync) {
            Sync() // sync first Execute
            _doSync = true
        }

        pins.i2cWriteBuffer(0x52, Buffer.fromUTF8(text), false);
        let buf2 = pins.createBuffer(1)
        buf2[0] = 10
        pins.i2cWriteBuffer(0x52, buf2)
        ReadResponse()
    }

    //% block="Set Stat LED to high %high (ms), low %low (ms), count %count "
    //% high.defl="100"
    //% low.defl="100"
    //% count.defl="10"
    export function SetStatLed(high: number, low: number, count:number): void {
        if (!_doSync) {
            Sync() // sync first Execute
            _doSync = true
        }

        const cmd = `statled(${high},${low},${count})`;
        ExecuteCommandNoReturn(cmd);
    }

    //% block="Select device %index "
    //% index.defl="1"
    export function Select(index: number): void {
        if (!_doSync) {
            Sync() // sync first Execute
            _doSync = true
        }        

        const cmd = `sel(${index})`;
        ExecuteCommandNoReturn(cmd);
    }

    //% block="Stop all"   
    //% weight=10
    export function StopAll(): void {
        if (!_doSync) {
            Sync() // sync first Execute
            _doSync = true
        }

        let buf22 = pins.createBuffer(1)
        buf22[0] = 27
        pins.i2cWriteBuffer(0x52, buf22)
        pause(100)        
    }

    //% block="Run"  
    //% weight=20
    export function Run(): void {
        if (!_doSync) {
            Sync() // sync first Execute
            _doSync = true
        }

        const cmd = `run`;
        ExecuteCommandNoReturn(cmd);
    }

    //% blockHidden=1
    function ReadResponse(): string {
        _value_response = -1
        _str_response = ""
        let timeout = _timeout
      
        while (_value_response != 10 && timeout > 0) {
            _value_response = pins.i2cReadNumber(0x52, NumberFormat.UInt8LE, false)
            //\r is not put added because < 32
            if (_value_response >= 32 && _value_response < 127) {
                _str_response = "" + _str_response + String.fromCharCode(_value_response)
                timeout = _timeout
            } else {
                pause(1)
                timeout--
            }
        }
                
        // we only need number like: "123\r\n>". We only need number
        // this will clear > or any garbage then
        pause(2) 
        _value_response = -1
        while (_value_response != 255) {
            _value_response = pins.i2cReadNumber(82, NumberFormat.UInt8LE, false)
            pause(1)
        }

        return _str_response
    }

    //% blockHidden=1
    function WriteBytes(array_name: string, data: number[]): number {
        const count = data.length
        const cmd = `strmwr(${array_name},${count})`;

        WriteCommand(cmd)

        _value_response = -1
        _str_response = ""
        let timeout = _timeout

        while (_value_response != 38 && timeout > 0) { // 38 is &
            _value_response = pins.i2cReadNumber(0x52, NumberFormat.UInt8LE, false)
            pause(1)
            timeout--
        }

        if (timeout == 0)
            return -1

        WriteRawData(data)        
        ReadResponse()
        return count
    }

    //% blockHidden=1
    function ReadBytes(array_name: string, data: number[]): number {
        const count = data.length
        const cmd = `strmrd(${array_name},${count})`;

        WriteCommand(cmd)

        _value_response = -1
        _str_response = ""
        let timeout = _timeout

        while (_value_response != 38 && timeout > 0) { // 38 is &
            _value_response = pins.i2cReadNumber(0x52, NumberFormat.UInt8LE, false)
            pause(1)
            timeout--
        }

        if (timeout == 0)
            return -1

        ReadRawData(data, 0, count)
        ReadResponse()
        return count
    }

    //% blockHidden=1
    export function WriteFloats(array_name: string, data: number []): number {
        const count = data.length
        const cmd = `strmwr(${array_name},${count})`;

        WriteCommand(cmd)

        _value_response = -1
        _str_response = ""
        let timeout = _timeout

        while (_value_response != 38 && timeout > 0) { // 38 is &
            _value_response = pins.i2cReadNumber(0x52, NumberFormat.UInt8LE, false)
            pause(1)
            timeout--
        }

        if (timeout == 0)
            return -1

        for (let i = 0; i < data.length; i++) {
            let buffer = control.createBuffer(4);
            buffer.setNumber(NumberFormat.Float32LE, 0, data[i]);

            WriteRawData([buffer[0], buffer[1], buffer[2], buffer[3]]);
        }

        ReadResponse()
        return count
    }

    //% blockHidden=1
    function WriteRawData(data: number[]): number {
        let buf = pins.createBuffer(1)
        for (let i = 0; i < data.length; i++) {
            let byte = Math.floor(data[i]) & 0xFF;
            buf[0] = byte
            pins.i2cWriteBuffer(0x52, buf)
        }

        return data.length
    }

    //% blockHidden=1
    function ReadRawData(data: number[], offset: number, count: number): number {
        let timeout = _timeout;
        let i = 0;

        while (i < count) {
            data[offset + i] = pins.i2cReadNumber(0x52, NumberFormat.UInt8LE, false)
            i = i + 1            
            pause(1)
        }

        return count
    }

    //% blockHidden=1
    function WriteCommand(text: string): void {
        if (!_doSync) {
            Sync() // sync first Execute
            _doSync = true
        }

        pins.i2cWriteBuffer(0x52, Buffer.fromUTF8(text), false);
        let buf2 = pins.createBuffer(1)
        buf2[0] = 10
        pins.i2cWriteBuffer(0x52, buf2)        
    }
    
    //% blockHidden=1
    function Sync() {
        _value_response = -1
        _str_response = ""
        _timeout = 1000

        let buf22 = pins.createBuffer(1)
        //buf22[0] = 27
        //pins.i2cWriteBuffer(0x52, buf22)
        //pause(100)

        buf22[0] = 10
        pins.i2cWriteBuffer(0x52, buf22)
        pause(300)
        
        ReadResponse()
    }
}
